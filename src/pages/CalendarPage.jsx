import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  getBookedSlotsForDate,
  saveAppointment,
  TIME_SLOTS,
  cairoToday,
  addDays,
  isFriday,
  isSlotPast,
  getBookingErrorMessage
} from '../utils/calendarStorage';
import { useTranslation } from 'react-i18next';
import {
  Calendar as CalendarIcon,
  Clock,
  Lock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  PlusCircle,
  X,
  ExternalLink,
  Loader2,
  Copy,
  Check,
  Bookmark,
  Home,
  MessageSquare
} from 'lucide-react';
import { SiteNavbar } from '../components/SiteNavbar';

export default function CalendarPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // D-31: dates are Cairo dates; Friday is shown but closed.
  const todayStr = cairoToday();

  // Generate the next 7 days starting from today (Cairo)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDays(todayStr, i);
    const d = new Date(`${dateStr}T12:00:00Z`);
    return {
      dateStr,
      dayNameAr: d.toLocaleDateString('ar-EG', { weekday: 'short', timeZone: 'UTC' }),
      dayNameEn: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      dayNumber: d.getUTCDate(),
      closed: isFriday(dateStr),
    };
  });
  const firstOpenDay = isFriday(todayStr) ? addDays(todayStr, 1) : todayStr;

  const [selectedDate, setSelectedDate] = useState(firstOpenDay);
  const selectedDayClosed = isFriday(selectedDate);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [service, setService] = useState('');
  const [notes, setNotes] = useState('');
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastBookedAppointment, setLastBookedAppointment] = useState(null);
  const [bookingError, setBookingError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [deviceBookings, setDeviceBookings] = useState([]);

  // Load device bookings from localStorage (D-26 Default A) & prune expired bookings
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sard_device_bookings') || '[]');
      if (Array.isArray(stored)) {
        // Prune bookings that are in the past (older than today)
        const valid = stored.filter(b => b.date && b.date >= todayStr);
        setDeviceBookings(valid);
        if (valid.length !== stored.length) {
          localStorage.setItem('sard_device_bookings', JSON.stringify(valid));
        }
      }
    } catch {
      // ignore
    }
  }, [todayStr]);

  async function loadSlots(dateStr) {
    setLoadingSlots(true);
    try {
      const slots = await getBookedSlotsForDate(dateStr || selectedDate);
      setBookedSlots(Array.isArray(slots) ? slots : []);
    } catch (err) {
      console.error('Failed to load slots from database:', err);
    } finally {
      setLoadingSlots(false);
    }
  }

  useEffect(() => {
    loadSlots(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot || !name || submitting) return;

    setSubmitting(true);
    setBookingError('');
    try {
      const created = await saveAppointment({
        date: selectedDate,
        timeSlot: selectedSlot,
        name,
        email,
        service: service || (isRTL ? "استشارة أتمتة وحلول ذكاء اصطناعي" : "AI Consultation"),
        notes,
        created_via: 'web_form'
      });

      await loadSlots(selectedDate);
      setLastBookedAppointment(created);

      // Save to device bookings if manageToken is present (HF-02)
      if (created.manageToken) {
        try {
          const existing = JSON.parse(localStorage.getItem('sard_device_bookings') || '[]');
          const filtered = existing.filter(b => b.id !== created.id);
          filtered.unshift({
            id: created.id,
            token: created.manageToken,
            date: created.date,
            slot: created.timeSlot || created.time_slot,
            service: created.service || created.service_type,
          });
          const limited = filtered.slice(0, 10);
          localStorage.setItem('sard_device_bookings', JSON.stringify(limited));
          setDeviceBookings(limited);
        } catch {
          // ignore
        }
      }

      setSelectedSlot('');
      setName('');
      setService('');
      setNotes('');
    } catch (err) {
      console.error('Failed submitting booking:', err);
      setBookingError(getBookingErrorMessage(err, isRTL));
      if (err.code === '23505' || err.message?.includes('23505') || err.message?.includes('SLOT_ALREADY_BOOKED')) {
        await loadSlots(selectedDate);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const buildGoogleCalendarUrl = (apt) => {
    const title = `Sard AI: ${apt.service || apt.service_type || 'Consultation'}`;
    const desc = `Appointment with Sard AI.\nClient: ${apt.name || apt.client_name}\nTime Slot: ${apt.timeSlot || apt.time_slot}\nNotes: ${apt.notes || 'None'}`;
    const dateFormatted = (apt.date || todayStr).replace(/-/g, '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${dateFormatted}/${dateFormatted}&details=${encodeURIComponent(desc)}`;
  };

  const getManageUrl = (id, token) => {
    if (typeof window === 'undefined') return `/calendar/manage/${id}#t=${token}`;
    return `${window.location.origin}/calendar/manage/${id}#t=${token}`;
  };

  const handleCopyLink = (url) => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const calendarLinks = [
    { to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
    { to: '/ai', icon: MessageSquare, label_ar: 'احجز بالذكاء الاصطناعي', label_en: 'Book with AI' },
  ];

  const calendarDrawerLinks = [
    { to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
    { to: '/ai', icon: MessageSquare, label_ar: 'مساعد الذكاء الاصطناعي', label_en: 'Sard AI Chat' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors flex flex-col">
      <SiteNavbar links={calendarLinks} drawerLinks={calendarDrawerLinks} />

      <div className="max-w-5xl mx-auto space-y-8 w-full py-8 px-4 sm:px-8 flex-1">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange/15 border border-brand-orange/30 text-brand-orange text-xs sm:text-sm font-bold shadow-sm">
            <CalendarIcon className="w-4 h-4" />
            <span>{t('calendar.badge')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground">
            {t('calendar.title')}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            {t('calendar.subtitle')}
          </p>
        </div>

        {/* Success Alert & Manage Link (HF-02) */}
        {lastBookedAppointment && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-foreground space-y-4 shadow-md"
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <p className="font-bold text-base text-foreground">
                    {isRTL ? "تم تأكيد موعدك بنجاح!" : "Your appointment is confirmed!"}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {isRTL
                      ? `تم حجز موعدك يوم ${lastBookedAppointment.date} في تمام الساعة ${lastBookedAppointment.timeSlot || lastBookedAppointment.time_slot}.`
                      : `Booked for ${lastBookedAppointment.date} at ${lastBookedAppointment.timeSlot || lastBookedAppointment.time_slot}.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={buildGoogleCalendarUrl(lastBookedAppointment)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-brand-orange" />
                  <span>{isRTL ? "إضافة لتقويم Google" : "Google Calendar"}</span>
                </a>

                <button
                  type="button"
                  onClick={() => setLastBookedAppointment(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Manage Token Link Display */}
            {lastBookedAppointment.manageToken && (
              <div className="pt-3 border-t border-emerald-500/20 space-y-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-brand-orange" />
                  {isRTL ? "رابط إدارة حجزك الخاص" : "Your private booking link"}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  {isRTL
                    ? "احفظ هذا الرابط — هو الطريقة الوحيدة لعرض حجزك أو إلغائه لاحقاً. لا تشاركه مع أي شخص."
                    : "Save this link — it's the only way to view or cancel your booking later. Don't share it with anyone."}
                </p>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <input
                    type="text"
                    readOnly
                    value={getManageUrl(lastBookedAppointment.id, lastBookedAppointment.manageToken)}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-muted-foreground outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => handleCopyLink(getManageUrl(lastBookedAppointment.id, lastBookedAppointment.manageToken))}
                    className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? (isRTL ? "تم النسخ" : "Copied") : (isRTL ? "نسخ الرابط" : "Copy link")}</span>
                  </button>

                  <Link
                    to={`/calendar/manage/${lastBookedAppointment.id}#t=${lastBookedAppointment.manageToken}`}
                    className="px-3 py-1.5 rounded-lg bg-brand-orange text-black font-bold text-xs hover:bg-brand-orange-400 transition-colors shadow-sm"
                  >
                    {isRTL ? "عرض الحجز" : "View booking"}
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Device Bookings Banner (Saved in localStorage on this device) */}
        {deviceBookings.length > 0 && (
          <div className="p-4 rounded-2xl bg-card border border-border space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Bookmark className="w-4 h-4 text-brand-orange" />
                  {isRTL ? "حجوزاتك على هذا الجهاز" : "Your bookings on this device"}
                </span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {isRTL ? "تظهر هنا فقط على هذا الجهاز والمتصفح." : "Shown only on this device and browser."}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground">({deviceBookings.length})</span>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {deviceBookings.map((b) => (
                <div
                  key={b.id}
                  className="p-3 rounded-xl bg-secondary/40 border border-border flex items-center justify-between text-xs gap-2"
                >
                  <div className="space-y-0.5 truncate">
                    <p className="font-bold text-foreground">{b.date} - {b.slot}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{b.service}</p>
                  </div>

                  <Link
                    to={`/calendar/manage/${b.id}#t=${b.token}`}
                    className="px-2.5 py-1 rounded-lg bg-brand-orange/15 hover:bg-brand-orange/25 text-brand-orange font-bold shrink-0 transition-colors"
                  >
                    {isRTL ? "عرض الحجز" : "View booking"}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Booking Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Date Picker & Current Week Buttons + Slots (min-w-0: let the week bar scroll instead of widening the card) */}
          <div className="min-w-0 lg:col-span-7 bg-card border border-border rounded-2xl p-6 space-y-6 shadow-sm">

            {/* Week Days Quick Bar */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-brand-orange" />
                  {isRTL ? "أيام هذا الأسبوع:" : "Current Week:"}
                </span>
                <span className="text-xs text-brand-orange font-mono">{selectedDate}</span>
              </label>

              <div className="flex sm:grid sm:grid-cols-7 gap-2 overflow-x-auto pb-2 text-center -mx-1 px-1 scrollbar-thin">
                {weekDays.map((day) => {
                  const isSelected = selectedDate === day.dateStr;
                  return (
                    <button
                      key={day.dateStr}
                      type="button"
                      disabled={day.closed}
                      aria-disabled={day.closed}
                      data-closed={day.closed ? 'true' : undefined}
                      title={day.closed ? t('calendar.fridayClosed') : undefined}
                      onClick={() => {
                        setSelectedDate(day.dateStr);
                        setSelectedSlot('');
                      }}
                      className={`min-w-[64px] sm:min-w-0 flex-1 p-2 sm:p-2.5 rounded-xl border flex flex-col items-center justify-center shrink-0 sm:shrink transition-all ${day.closed
                        ? "bg-muted/40 border-border text-muted-foreground/50 cursor-not-allowed line-through"
                        : isSelected
                        ? "bg-brand-orange text-black font-bold border-brand-orange shadow-md scale-105"
                        : "bg-secondary/60 border-border text-foreground hover:border-brand-orange/60"
                        }`}
                    >
                      <span className="text-[11px] uppercase font-semibold whitespace-nowrap">{isRTL ? day.dayNameAr : day.dayNameEn}</span>
                      <span className="text-sm font-bold mt-0.5">{day.dayNumber}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Date Input Fallback */}
            <div className="pt-2">
              <input
                type="date"
                min={todayStr}
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlot('');
                }}
                className="w-full bg-background border border-border rounded-xl px-4 py-2 text-xs sm:text-sm text-foreground focus:border-brand-orange outline-none"
              />
            </div>

            <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-orange shrink-0" />
              <span>{t('calendar.workingHours')}</span>
            </div>

            {/* Slots Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-foreground">
                  {t('calendar.slotsLabel')}
                </label>
                {loadingSlots && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin text-brand-orange" />
                    {isRTL ? "تحديث المواعيد..." : "Syncing..."}
                  </span>
                )}
              </div>

              {selectedDayClosed && (
                <p role="status" className="text-sm text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border" data-testid="friday-closed">
                  {t('calendar.fridayClosed')}
                </p>
              )}
              {!selectedDayClosed && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {TIME_SLOTS.map((slot) => {
                  const isBooked = bookedSlots.includes(slot) || isSlotPast(selectedDate, slot);
                  const isSelected = selectedSlot === slot;

                  if (isBooked) {
                    return (
                      <div
                        key={slot}
                        className="p-3 rounded-xl bg-muted/50 border border-border text-muted-foreground/60 cursor-not-allowed flex items-center justify-between opacity-50 select-none line-through"
                      >
                        <span className="text-xs font-semibold">{slot}</span>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                          <Lock className="w-3 h-3" />
                          <span>{t('calendar.booked')}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className={`p-3 rounded-xl border text-xs sm:text-sm font-bold transition-all flex items-center justify-between cursor-pointer ${isSelected
                        ? "bg-brand-orange text-black border-brand-orange shadow-md scale-102"
                        : "bg-secondary/40 border-border text-foreground hover:border-brand-orange/60"
                        }`}
                    >
                      <span>{slot}</span>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-black" />
                      ) : (
                        <PlusCircle className="w-4 h-4 text-muted-foreground/60" />
                      )}
                    </button>
                  );
                })}
              </div>
              )}
            </div>

          </div>

          {/* Booking Confirmation Form */}
          <div className="min-w-0 lg:col-span-5 bg-card border border-border rounded-2xl p-6 space-y-5 shadow-sm">
            <h3 className="text-lg font-bold text-foreground pb-2 border-b border-border">
              {t('calendar.confirmDetails')}
            </h3>

            {/* Selected Slot Recap */}
            <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-1">
              <span className="text-xs text-muted-foreground font-semibold">
                {t('calendar.selectedSlotTitle')}
              </span>
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">
                  {selectedDate} {selectedSlot ? `| ${selectedSlot}` : ''}
                </p>
                {!selectedSlot && (
                  <span className="text-xs text-brand-orange animate-pulse font-medium">
                    {t('calendar.chooseSlot')}
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {t('calendar.nameLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('calendar.namePlaceholder')}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-brand-orange outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {t('calendar.emailLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('calendar.emailPlaceholder')}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-brand-orange outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {t('calendar.serviceLabel')}
                </label>
                <input
                  type="text"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder={isRTL ? "استشارة أتمتة الأعمال / حلول ذكية" : "Business Automation / AI Consultation"}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-brand-orange outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {t('calendar.notesLabel')}
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('calendar.notesPlaceholder')}
                  className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:border-brand-orange outline-none resize-none"
                />
              </div>

              {bookingError && (
                <p className="text-xs text-red-600 font-semibold">{bookingError}</p>
              )}

              {/* D-34 interim data-collection notice (O-10); legal review pending (C-I03) */}
              <p className="text-[11px] text-muted-foreground leading-relaxed" data-testid="booking-notice">
                {t('bookingNotice.text')}{' '}
                <Link to="/privacy" className="text-brand-orange hover:underline">{t('bookingNotice.link')}</Link>
              </p>

              <button
                type="submit"
                disabled={!selectedSlot || !name || !email || submitting}
                className="w-full py-3 rounded-xl bg-brand-orange text-black font-bold text-sm hover:bg-brand-orange-400 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>{t('calendar.saving')}</span>
                  </>
                ) : (
                  <span>{t('calendar.bookNow')}</span>
                )}
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
