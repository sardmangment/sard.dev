import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2, CheckCircle2, AlertTriangle, Eye, EyeOff, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../ConfirmDialog';
import { normalizeAssistantKey, isPlausibleAssistantKey } from '../../config/assistantKeyFormat';

// DEV-212: set the AI assistant's Gemini API key from the admin (api/admin/assistant-key.js).
// The saved key is never sent back to the browser: only where it comes from and its last 4 characters.
// A new key is tested with Google before it is saved.

export default function AssistantKeyManager({ request }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { kind: 'ok'|'error', text }
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await request('/api/admin/assistant-key'));
    } catch {
      setMessage({ kind: 'error', text: t('adminAssistant.errors.load_failed') });
    } finally {
      setLoading(false);
    }
  }, [request, t]);

  useEffect(() => { load(); }, [load]);

  const save = async (e) => {
    e.preventDefault();
    const key = normalizeAssistantKey(value);
    setMessage(null);
    if (!isPlausibleAssistantKey(key)) { setMessage({ kind: 'error', text: t('adminAssistant.errors.invalid_key') }); return; }
    setBusy(true);
    try {
      const data = await request('/api/admin/assistant-key', { method: 'POST', body: { key } });
      setStatus((s) => ({ ...s, ...data }));
      setValue('');
      setShow(false);
      setMessage({ kind: 'ok', text: t('adminAssistant.saved') });
    } catch (err) {
      const code = ['invalid_key', 'key_rejected'].includes(err.code) ? err.code : 'save_failed';
      setMessage({ kind: 'error', text: t(`adminAssistant.errors.${code}`) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const data = await request('/api/admin/assistant-key', { method: 'DELETE' });
      setStatus((s) => ({ ...s, ...data }));
      setMessage({ kind: 'ok', text: t('adminAssistant.removed') });
    } catch {
      setMessage({ kind: 'error', text: t('adminAssistant.errors.delete_failed') });
    } finally {
      setBusy(false);
      setConfirmRemove(false);
    }
  };

  const when = status?.updatedAt
    ? new Date(status.updatedAt).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <section className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-5 shadow-sm" data-testid="manager-assistant">
      <div className="border-b border-border pb-3">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-brand-orange" aria-hidden="true" />
          {t('adminAssistant.title')}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">{t('adminAssistant.hint')}</p>
      </div>

      {/* Current key */}
      <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-1" data-testid="assistant-key-status" aria-busy={loading}>
        <p className="text-xs font-semibold text-muted-foreground">{t('adminAssistant.current')}</p>
        {loading ? (
          <div className="h-5 w-48 rounded bg-muted animate-pulse" />
        ) : status ? (
          <>
            <p className="text-sm font-bold text-foreground flex flex-wrap items-center gap-x-2" data-source={status.source}>
              {t(`adminAssistant.source.${status.source}`)}
              {status.source === 'admin' && status.last4 && (
                <span className="font-mono text-muted-foreground" dir="ltr">••••••••{status.last4}</span>
              )}
            </p>
            {when && status.source === 'admin' && <p className="text-xs text-muted-foreground">{t('adminAssistant.updated', { when })}</p>}
            {status.source === 'none' && (
              <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />{t('adminAssistant.noneWarning')}</p>
            )}
          </>
        ) : null}
      </div>

      {/* New key */}
      <form onSubmit={save} className="space-y-3" autoComplete="off">
        <label htmlFor="assistant-key" className="block text-sm font-semibold text-foreground">{t('adminAssistant.newKey')}</label>
        <div className="flex items-stretch gap-2">
          <input
            id="assistant-key"
            name="assistant-key"
            type={show ? 'text' : 'password'}
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="AIza…"
            maxLength={600}
            className="flex-1 min-w-0 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono text-foreground outline-none focus:ring-2 focus:ring-brand-orange/40"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={t(show ? 'adminAssistant.hideKey' : 'adminAssistant.showKey')}
            title={t(show ? 'adminAssistant.hideKey' : 'adminAssistant.showKey')}
            className="px-3 rounded-xl border border-border hover:bg-secondary cursor-pointer"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t('adminAssistant.newKeyHint')}</p>

        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            data-testid="assistant-key-message"
            className={`text-sm font-semibold flex items-center gap-2 ${message.kind === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}
          >
            {message.kind === 'ok' ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4" aria-hidden="true" />}
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap gap-2 justify-end">
          {status?.source === 'admin' && (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              disabled={busy}
              data-testid="assistant-key-remove"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 text-sm font-bold hover:bg-red-500/20 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              {t('adminAssistant.remove')}
            </button>
          )}
          <button
            type="submit"
            disabled={busy || !value.trim()}
            data-testid="assistant-key-save"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-bold hover:bg-brand-orange/90 cursor-pointer disabled:opacity-50"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
            {t(busy ? 'adminAssistant.testing' : 'adminAssistant.save')}
          </button>
        </div>
      </form>

      {confirmRemove && (
        <ConfirmDialog
          testId="assistant-key-remove-confirm"
          title={t('adminAssistant.removeTitle')}
          body={t(status?.envConfigured ? 'adminAssistant.removeBodyEnv' : 'adminAssistant.removeBodyNone')}
          confirmLabel={t('adminAssistant.removeConfirm')}
          cancelLabel={t('adminContent.cancel')}
          closeLabel={t('careersPage.form.close')}
          busy={busy}
          onConfirm={remove}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </section>
  );
}
