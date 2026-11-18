import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, CheckCircle2, ArrowRight, ArrowLeft, Copy, Check, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { saveAppointment, getBookingErrorMessage } from "../utils/calendarStorage";
import { buildSystemInstruction } from "../content/assistantKnowledge";
import { supabase } from "../integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { SiteNavbar } from "./SiteNavbar";
import ThinkingIndicator from "./ThinkingIndicator";
import StreamingBotMessage from "./StreamingBotMessage";

// Supported Gemini models per Google AI deprecations policy (DEV-90 / SU-T29)
const SUPPORTED_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash"
];

async function queryGemini(contents, systemInstructionText) {
  // Server-side Edge proxy only (/api/chat per DEV-83 / Proposal D-18)
  // Eliminates client bundle exposure of API keys; strictly no browser key fallback.
  const proxyRes = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstructionText,
      model: "gemini-3.5-flash-lite",
    }),
  });

  if (!proxyRes.ok) {
    let errMessage = "AI service temporarily unavailable. Please try again later.";
    try {
      const errData = await proxyRes.json();
      if (errData?.error) errMessage = errData.error;
    } catch {
      // ignore parse error if response body is non-json
    }
    throw new Error(errMessage);
  }

  const data = await proxyRes.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Unable to parse AI response.");
  }
  return text;
}

export default function ChatPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [textPrompt, setTextPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [started, setStarted] = useState(false);
  const [lastBooking, setLastBooking] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [partnerNames, setPartnerNames] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // C-F03: names of publication-verified partners only; contract data never reaches the model.
    async function fetchPartners() {
      const { data, error } = await supabase.rpc('get_published_partners');
      if (!error && Array.isArray(data)) {
        setPartnerNames(data.map((p) => `${p.partner_name_en} (${p.partner_name_ar})`));
      }
    }

    fetchPartners();
  }, []);

  const systemInstruction = buildSystemInstruction(i18n.getFixedT('en'), {
    partnerNames,
    replyLanguage: isRTL ? 'Arabic' : 'English',
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit() {
    const text = textPrompt.trim();
    if (!text) return;

    if (!started) setStarted(true);

    const userMsg = { sender: "user", text };
    setMessages(prev => [...prev, userMsg]);
    setTextPrompt("");
    setLoading(true);

    try {
      const TOKEN_REGEX = /\S*\/calendar\/manage\/[^\s]*#t=[0-9a-f]+/gi;
      const conversationContents = messages.map(msg => ({
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: (msg.text || "").replace(TOKEN_REGEX, "[manage-link-redacted]") }]
      }));
      conversationContents.push({
        role: "user",
        parts: [{ text: (text || "").replace(TOKEN_REGEX, "[manage-link-redacted]") }]
      });

      let reply = await queryGemini(conversationContents, systemInstruction);

      if (reply.includes("[BOOKING_REQUEST:")) {
        try {
          const match = reply.match(/\[BOOKING_REQUEST:\s*Date:\s*([\d-]+)\s*\|\s*Time:\s*([\d:\s\w]+)\s*\|\s*Name:\s*([^|]+)\s*\|\s*Service:\s*([^\]]+)\]/i);
          if (match) {
            const date = match[1].trim();
            const timeSlot = match[2].trim();
            const name = match[3].trim() || 'Chat User';
            const service = match[4].trim() || 'AI Consultation';

            const newBooking = await saveAppointment({
              date: date || new Date().toISOString().split('T')[0],
              timeSlot: timeSlot || '02:00 PM',
              name,
              email: 'chat@sard.ai',
              service,
              notes: 'Booked via Sard AI Chat Assistant',
              created_via: 'ai_chat'
            });

            setLastBooking(newBooking);

            // Save to device bookings if manageToken is present (HF-02) & prune past bookings
            if (newBooking?.manageToken) {
              try {
                const today = new Date().toISOString().split('T')[0];
                const existing = JSON.parse(localStorage.getItem('sard_device_bookings') || '[]');
                const filtered = existing.filter(b => b.id !== newBooking.id && (!b.date || b.date >= today));
                filtered.unshift({
                  id: newBooking.id,
                  token: newBooking.manageToken,
                  date: newBooking.date,
                  slot: newBooking.timeSlot || newBooking.time_slot,
                  service: newBooking.service || newBooking.service_type,
                });
                localStorage.setItem('sard_device_bookings', JSON.stringify(filtered.slice(0, 10)));
              } catch {
                // ignore
              }
            }

            reply = reply.replace(/\[BOOKING_REQUEST:[^\]]+\]/g, "").trim() +
              (isRTL ? "\n\n✅ تم تسجيل موعدك بنجاح في الكالندر!" : "\n\n✅ Your appointment has been recorded in the Calendar!");
          } else {
            // Strip malformed raw booking tag
            reply = reply.replace(/\[BOOKING_REQUEST:[^\]]+\]/g, "").trim();
          }
        } catch (e) {
          console.error("Booking failed:", e);
          // Always strip the raw booking tag so user never sees internal tokens
          reply = reply.replace(/\[BOOKING_REQUEST:[^\]]+\]/g, "").trim();
          reply += `\n\n⚠️ ${getBookingErrorMessage(e, isRTL)}`;
        }
      }

      setMessages(prev => [...prev, { sender: "bot", text: reply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        sender: "bot",
        text: isRTL
          ? "عذرًا، تعذّر الوصول إلى المساعد الآن. يمكنك المحاولة لاحقًا، أو حجز اجتماع استكشافي من صفحة المواعيد، أو التواصل معنا عبر support@sard.info."
          : "Sorry, the assistant is unavailable right now. Please try again later, book a discovery meeting on the Calendar page, or contact us at support@sard.info."
      }]);
    }

    setLoading(false);
  }

  const chatLinks = [
    { to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
    { to: '/calendar', icon: Calendar, label_ar: 'جدول المواعيد', label_en: 'Calendar' },
  ];

  const chatDrawerLinks = [
    { to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
    { to: '/calendar', icon: Calendar, label_ar: 'جدول المواعيد', label_en: 'Calendar' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center transition-colors">
      <SiteNavbar links={chatLinks} drawerLinks={chatDrawerLinks} sticky={true} />

      {/* Booking Success Banner */}
      {lastBooking && (
        <div className="w-full max-w-3xl px-4 mt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-xl bg-brand-orange/15 border border-brand-orange/40 flex items-center justify-between text-xs shadow-sm"
          >
            <div className="flex items-center gap-2 text-foreground font-medium">
              <CheckCircle2 className="w-4 h-4 text-brand-orange shrink-0" />
              <span>{t('chat.bookedBanner')} ({lastBooking.date} - {lastBooking.timeSlot})</span>
            </div>
            <div className="flex items-center gap-2">
              {lastBooking.manageToken && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const url = `${window.location.origin}/calendar/manage/${lastBooking.id}#t=${lastBooking.manageToken}`;
                        navigator.clipboard.writeText(url);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }
                    }}
                    className="px-2.5 py-1 bg-card border border-brand-orange/40 text-brand-orange font-bold rounded-lg hover:bg-brand-orange/10 transition-colors flex items-center gap-1 text-xs cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? (isRTL ? "تم النسخ" : "Copied") : (isRTL ? "نسخ الرابط" : "Copy link")}</span>
                  </button>
                  <Link
                    to={`/calendar/manage/${lastBooking.id}#t=${lastBooking.manageToken}`}
                    className="px-2.5 py-1 bg-card border border-brand-orange/40 text-brand-orange font-bold rounded-lg hover:bg-brand-orange/10 transition-colors"
                  >
                    {isRTL ? "عرض الحجز" : "View booking"}
                  </Link>
                </>
              )}
              <Link
                to="/calendar"
                className="px-2.5 py-1 bg-brand-orange text-black font-bold rounded-lg hover:bg-brand-orange-400 transition-colors"
              >
                {t('chat.viewCalendar')}
              </Link>
            </div>
          </motion.div>
        </div>
      )}

      {/* Main Chat Stream Container directly on page background */}
      <div className="w-full max-w-3xl flex-1 flex flex-col px-4 py-6 space-y-6">

        {/* Welcome Text */}
        {!started && (
          <div className="py-8 space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">{t('chat.welcomeTitle')}</h1>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">{t('chat.welcomeDesc')}</p>
          </div>
        )}

        {/* Messages List - Direct Text on Page */}
        <div className="flex-1 space-y-6">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              {msg.sender === "bot" ? (
                /* Plain Text AI Response on Page Background */
                <StreamingBotMessage fullText={msg.text} isRTL={isRTL} />
              ) : (
                /* Plain Text User Prompt with Bidirectional Direction and Placement */
                <div className="w-full py-2 flex justify-end">
                  <div className="max-w-[85%] text-end">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1">
                      {isRTL ? "أنت" : "You"}
                    </span>
                    <p
                      dir="auto"
                      className="text-brand-orange font-semibold text-base sm:text-lg text-start break-words"
                    >
                      {msg.text}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          {/* Minimal Text Thinking Line */}
          {loading && <ThinkingIndicator isRTL={isRTL} />}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input Box with iOS Safe Area support */}
        <div className="sticky bottom-0 z-20 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-background via-background/95 to-transparent">
          <div className="flex items-center bg-card border border-border focus-within:border-brand-orange rounded-xl p-2 shadow-lg backdrop-blur-sm">
            <input
              type="text"
              dir="auto"
              value={textPrompt}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              onChange={(e) => setTextPrompt(e.target.value)}
              placeholder={t('chat.inputPlaceholder')}
              className="flex-1 bg-transparent text-foreground placeholder-muted-foreground outline-none px-3 py-1.5 text-sm sm:text-base text-start"
            />
            <button
              onClick={handleSubmit}
              disabled={loading || !textPrompt.trim()}
              className={`p-2.5 rounded-lg font-bold transition-all shrink-0 ${
                textPrompt.trim() && !loading
                  ? "bg-brand-orange text-black hover:bg-brand-orange-400 cursor-pointer"
                  : "bg-muted text-muted-foreground/60 cursor-not-allowed"
              }`}
            >
              {isRTL ? <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" /> : <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}