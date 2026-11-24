import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X, Upload, CheckCircle2, Loader2 } from 'lucide-react';

// DEV-192: in-site application form for /careers. Posts multipart/form-data to /api/careers/apply.
// `opening` = a published opening, or null for a general application.

const MAX_CV = 5 * 1024 * 1024;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,25}$/;

function validate(fd, file) {
  const errs = {};
  const v = (k) => (fd.get(k) || '').toString().trim();
  if (v('full_name').length < 2) errs.full_name = 'required';
  if (!EMAIL_RE.test(v('email'))) errs.email = 'email';
  if (!PHONE_RE.test(v('phone'))) errs.phone = 'phone';
  if (v('profile_url') && !/^https?:\/\/\S+$/i.test(v('profile_url'))) errs.profile_url = 'url';
  if (!file) errs.cv = 'cv_missing';
  else if (file.size > MAX_CV) errs.cv = 'cv_too_large';
  else if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) errs.cv = 'cv_type';
  if (fd.get('consent') !== 'yes') errs.consent = 'consent';
  return errs;
}

function Field({ id, label, error, required, children }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}{required && <span className="text-brand-orange-700"> *</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} className="text-xs font-semibold text-red-600" role="alert">{t(`careersPage.form.errors.${error}`)}</p>}
    </div>
  );
}

const inputCls = (err) =>
  `w-full rounded-xl border bg-card px-4 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-brand-orange/40 ${err ? 'border-red-500' : 'border-border'}`;

export function ApplyDialog({ opening, isAr, onClose }) {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const firstRef = useRef(null);
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle'); // idle | sending | done | failed
  const [serverError, setServerError] = useState('');
  const [fileName, setFileName] = useState('');

  const title = opening ? (isAr ? opening.title_ar : opening.title_en) : t('careersPage.form.generalTitle');

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  async function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get('cv') instanceof File && fd.get('cv').size ? fd.get('cv') : null;
    const errs = validate(fd, file);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (opening) fd.set('opening_id', opening.id);
    setState('sending');
    setServerError('');
    try {
      const res = await fetch('/api/careers/apply', { method: 'POST', body: fd });
      if (res.ok) { setState('done'); return; }
      const body = await res.json().catch(() => ({}));
      const code = ['rate_limited', 'opening_unavailable', 'cv_type', 'cv_too_large', 'cv_missing'].includes(body.error) ? body.error : 'generic';
      if (body.error === 'invalid_input' && Array.isArray(body.fields)) {
        setErrors(Object.fromEntries(body.fields.map((f) => [f, f === 'consent' ? 'consent' : 'invalid'])));
      }
      setServerError(code);
      setState('failed');
    } catch {
      setServerError('generic');
      setState('failed');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-title"
        className="relative w-full sm:max-w-xl max-h-[92vh] overflow-y-auto bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl"
        data-testid="apply-dialog"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 pt-6 pb-4 bg-background border-b border-border">
          <div>
            <p className="text-xs font-semibold text-brand-orange-700">{t('careersPage.form.applyingFor')}</p>
            <h2 id="apply-title" className="text-xl font-bold text-foreground">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t('careersPage.form.close')} className="w-9 h-9 shrink-0 rounded-full bg-secondary hover:bg-secondary/70 flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {state === 'done' ? (
          <div className="px-6 py-12 text-center space-y-4" data-testid="apply-success">
            <CheckCircle2 className="w-14 h-14 mx-auto text-green-600" aria-hidden="true" />
            <h3 className="text-xl font-bold text-foreground">{t('careersPage.form.successTitle')}</h3>
            <p className="text-muted-foreground">{t('careersPage.form.successBody')}</p>
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl bg-brand-navy text-white font-semibold cursor-pointer">{t('careersPage.form.close')}</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="px-6 py-5 space-y-4">
            {/* Honeypot: hidden from people, filled by bots */}
            <div className="hidden" aria-hidden="true">
              <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
            </div>

            <Field id="full_name" label={t('careersPage.form.fullName')} error={errors.full_name} required>
              <input ref={firstRef} id="full_name" name="full_name" autoComplete="name" maxLength={120} className={inputCls(errors.full_name)} aria-invalid={!!errors.full_name} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="email" label={t('careersPage.form.email')} error={errors.email} required>
                <input id="email" name="email" type="email" dir="ltr" autoComplete="email" maxLength={200} className={inputCls(errors.email)} aria-invalid={!!errors.email} />
              </Field>
              <Field id="phone" label={t('careersPage.form.phone')} error={errors.phone} required>
                <input id="phone" name="phone" type="tel" dir="ltr" autoComplete="tel" maxLength={25} className={inputCls(errors.phone)} aria-invalid={!!errors.phone} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="city" label={t('careersPage.form.city')} error={errors.city}>
                <input id="city" name="city" autoComplete="address-level2" maxLength={80} className={inputCls(errors.city)} />
              </Field>
              <Field id="profile_url" label={t('careersPage.form.profileUrl')} error={errors.profile_url}>
                <input id="profile_url" name="profile_url" type="url" dir="ltr" placeholder="https://" maxLength={300} className={inputCls(errors.profile_url)} />
              </Field>
            </div>
            <Field id="message" label={t('careersPage.form.message')} error={errors.message}>
              <textarea id="message" name="message" rows={3} maxLength={2000} className={inputCls(errors.message)} />
            </Field>

            <Field id="cv" label={t('careersPage.form.cv')} error={errors.cv} required>
              <label htmlFor="cv" className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 cursor-pointer hover:border-brand-orange/60 ${errors.cv ? 'border-red-500' : 'border-border'}`}>
                <Upload className="w-5 h-5 text-brand-orange shrink-0" aria-hidden="true" />
                <span className="text-sm text-foreground truncate">{fileName || t('careersPage.form.cvHint')}</span>
              </label>
              <input id="cv" name="cv" type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => setFileName(e.target.files?.[0]?.name || '')} />
            </Field>

            <div className="space-y-1.5">
              <label className="flex items-start gap-3 text-sm text-foreground/85">
                <input type="checkbox" name="consent" value="yes" className="mt-1 w-4 h-4 accent-brand-orange" aria-invalid={!!errors.consent} />
                <span>
                  {t('careersPage.form.consent')}{' '}
                  <Link to="/privacy" target="_blank" className="font-semibold text-brand-orange-700 hover:underline">{t('careersPage.form.privacyLink')}</Link>
                </span>
              </label>
              {errors.consent && <p className="text-xs font-semibold text-red-600" role="alert">{t('careersPage.form.errors.consent')}</p>}
            </div>

            {state === 'failed' && (
              <p className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-semibold text-red-700" role="alert" data-testid="apply-error">
                {t(`careersPage.form.serverErrors.${serverError || 'generic'}`)}
              </p>
            )}

            <button
              type="submit"
              disabled={state === 'sending'}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brand-orange text-brand-gray-light font-bold hover:bg-brand-orange-400 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {state === 'sending' && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {t(state === 'sending' ? 'careersPage.form.sending' : 'careersPage.form.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default ApplyDialog;
