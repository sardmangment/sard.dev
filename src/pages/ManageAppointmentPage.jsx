import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  getAppointmentByToken,
  cancelAppointmentByToken
} from '../utils/calendarStorage';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Home
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SiteNavbar } from '../components/SiteNavbar';

export default function ManageAppointmentPage() {
  const { id } = useParams();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState(null);
  const [invalidToken, setInvalidToken] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [copied, setCopied] = useState(false);

  // Extract manage token once on mount and retain in memory across address bar hash cleanup
  const tokenRef = useRef('');
  if (!tokenRef.current && typeof window !== 'undefined') {
    const tokenMatch = window.location.hash.match(/[#&]t=([a-zA-Z0-9_-]+)/i);
    if (tokenMatch) {
      tokenRef.current = tokenMatch[1];
    }
  }
  const token = tokenRef.current;

  useEffect(() => {
    let isMounted = true;
    if (cancelSuccess) return;

    async function loadAppointment() {
      if (!id || !token) {
        if (isMounted) {
          setInvalidToken(true);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const apt = await getAppointmentByToken(id, token);
        if (!isMounted) return;

        if (apt) {
          setAppointment(apt);
          setInvalidToken(false);
        } else {
          setInvalidToken(true);
        }
      } catch {
        if (isMounted) setInvalidToken(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadAppointment();
    return () => { isMounted = false; };
  }, [id, token, cancelSuccess]);

  const handleCancel = async () => {
    const confirmPrompt = isRTL
      ? 'هل أنت متأكد من رغبتك في إلغاء هذا الموعد؟ سيتم إتاحة الموعد فوراً.'
      : 'Are you sure you want to cancel this appointment? The slot will become available immediately.';

    if (!window.confirm(confirmPrompt)) return;

    setCancelling(true);
    setCancelError('');

    try {
      await cancelAppointmentByToken(id, token);
      setCancelSuccess(true);
      setAppointment(prev => prev ? { ...prev, status: 'cancelled' } : null);

      // Security hardening: Clear token fragment from URL bar after cancellation
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      // Remove from local device storage
      try {
        const stored = JSON.parse(localStorage.getItem('sard_device_bookings') || '[]');
        const updated = stored.filter(b => b.id !== id);
        localStorage.setItem('sard_device_bookings', JSON.stringify(updated));
      } catch {
        // ignore
      }
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel appointment');
    } finally {
      setCancelling(false);
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const manageLinks = [
    { to: '/calendar', icon: CalendarIcon, label_ar: 'الكالندر', label_en: 'Calendar' },
  ];

  const manageDrawerLinks = [
    { to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
    { to: '/calendar', icon: CalendarIcon, label_ar: 'الكالندر', label_en: 'Calendar' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors flex flex-col">
      <SiteNavbar links={manageLinks} drawerLinks={manageDrawerLinks} />

      <div className="max-w-2xl mx-auto space-y-8 w-full py-8 px-4 sm:px-8 flex-1">

        {/* Content State */}
        {loading ? (
          <div className="p-12 text-center space-y-3 bg-card border border-border rounded-2xl shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-brand-orange mx-auto" />
            <p className="text-sm text-muted-foreground">
              {isRTL ? 'جاري التحقق من رمز الموعد...' : 'Verifying appointment token...'}
            </p>
          </div>
        ) : invalidToken || !appointment ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 rounded-2xl bg-card border border-border text-center space-y-5 shadow-sm"
          >
            <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-foreground">
                {isRTL ? 'الرابط غير صالح أو منتهي الصلاحية' : 'Link Invalid or Expired'}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {isRTL
                  ? 'هذا الرابط غير صالح أو انتهت صلاحيته. إذا فقدت رابط حجزك، تواصل معنا وسنساعدك.'
                  : "This link is invalid or has expired. If you lost your booking link, contact us and we'll help."}
              </p>
            </div>
            <Link
              to="/calendar"
              className="inline-block px-5 py-2.5 rounded-xl bg-brand-orange text-black font-bold text-sm hover:bg-brand-orange-400 transition-colors shadow-sm"
            >
              {isRTL ? 'العودة لصفحة الكالندر' : 'Back to Calendar'}
            </Link>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 sm:p-8 rounded-2xl bg-card border border-border space-y-6 shadow-md"
          >
            {/* Header Badge */}
            <div className="flex justify-between items-start flex-wrap gap-3 pb-4 border-b border-border">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                  {isRTL ? 'إدارة الموعد' : 'Manage Appointment'}
                </h1>
                <p className="text-xs text-muted-foreground mt-1">
                  {isRTL ? 'رابط خاص بك — لا تشاركه.' : "This is your private link — don't share it."}
                </p>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${appointment.status === 'confirmed'
                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                : 'bg-muted text-muted-foreground border-border'
                }`}>
                {appointment.status === 'confirmed'
                  ? (isRTL ? 'مؤكد' : 'Confirmed')
                  : (isRTL ? 'ملغي' : 'Cancelled')}
              </span>
            </div>

            {/* Appointment Details */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                  <CalendarIcon className="w-3.5 h-3.5 text-brand-orange" />
                  {isRTL ? 'التاريخ' : 'Date'}
                </span>
                <p className="text-sm font-bold text-foreground">{appointment.date}</p>
              </div>

              <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-brand-orange" />
                  {isRTL ? 'التوقيت' : 'Time Slot'}
                </span>
                <p className="text-sm font-bold text-foreground">
                  {appointment.timeSlot || appointment.time_slot}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-1">
              <span className="text-xs text-muted-foreground font-medium">
                {isRTL ? 'نوع الخدمة' : 'Service'}
              </span>
              <p className="text-sm font-bold text-brand-orange">
                {appointment.service || appointment.service_type || 'AI Consultation'}
              </p>
            </div>

            {/* Shareable Link Box */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
              <span className="text-xs text-foreground font-semibold block">
                {isRTL ? 'رابط إدارة حجزك الخاص' : 'Your private booking link'}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {isRTL
                  ? 'احفظ هذا الرابط — هو الطريقة الوحيدة لعرض حجزك أو إلغائه لاحقاً. لا تشاركه مع أي شخص.'
                  : "Save this link — it's the only way to view or cancel your booking later. Don't share it with anyone."}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== 'undefined' ? window.location.href : ''}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-muted-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? (isRTL ? 'تم النسخ' : 'Copied') : (isRTL ? 'نسخ الرابط' : 'Copy link')}</span>
                </button>
              </div>
            </div>

            {/* Cancel Status / Action */}
            {cancelSuccess || appointment.status === 'cancelled' ? (
              <div className="p-4 rounded-xl bg-muted/50 border border-border flex items-center gap-3 text-muted-foreground text-xs font-medium">
                <XCircle className="w-5 h-5 text-muted-foreground" />
                <span>{isRTL ? 'تم إلغاء هذا الحجز.' : 'This booking has been cancelled.'}</span>
              </div>
            ) : (
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {isRTL ? 'هل ترغب في تحرير هذا الموعد؟' : 'Need to free up this slot?'}
                </p>

                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  <span>{cancelling ? (isRTL ? 'جاري الإلغاء...' : 'Cancelling...') : (isRTL ? 'إلغاء الموعد' : 'Cancel Appointment')}</span>
                </button>
              </div>
            )}

            {cancelError && (
              <p className="text-xs text-red-600 font-semibold">{cancelError}</p>
            )}
          </motion.div>
        )}

      </div>
    </div>
  );
}

