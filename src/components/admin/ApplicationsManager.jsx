import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileDown, Trash2, Mail, Phone, MapPin, Link2, RefreshCw, X, Inbox } from 'lucide-react';

// DEV-194: job applications from /careers. List (newest first), filter by opening and status,
// change status, open the CV through a 60-second signed link, delete (also deletes the CV).

const STATUSES = ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'];
const STATUS_STYLE = {
  new: 'bg-brand-orange/15 text-brand-orange-700 border-brand-orange/30',
  reviewing: 'bg-brand-navy/10 text-brand-navy border-brand-navy/30',
  shortlisted: 'bg-emerald-500/10 text-emerald-700 border-emerald-600/30',
  rejected: 'bg-red-500/10 text-red-700 border-red-500/30',
  hired: 'bg-emerald-600 text-white border-emerald-700',
};
const SELECT = 'bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-brand-orange';

function ConfirmDelete({ name, onCancel, onConfirm }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 sm:p-6 overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div role="dialog" aria-modal="true" aria-label={t('adminApplications.deleteTitle')} data-testid="application-delete-confirm" className="my-auto w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h3 className="text-lg font-bold text-foreground">{t('adminApplications.deleteTitle')}</h3>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-lg hover:bg-secondary cursor-pointer" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-foreground">{t('adminApplications.deleteBody', { name })}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-secondary cursor-pointer">{t('adminContent.cancel')}</button>
            <button type="button" onClick={onConfirm} data-testid="confirm-application-delete" className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 cursor-pointer">{t('adminContent.deleteConfirm')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApplicationsManager({ request }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const [rows, setRows] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [opening, setOpening] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    request('/api/admin/content?type=openings')
      .then((d) => setOpenings(Array.isArray(d?.data) ? d.data : []))
      .catch(() => setOpenings([]));
  }, [request]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const qs = new URLSearchParams();
    if (opening) qs.set('opening', opening);
    if (status) qs.set('status', status);
    try {
      const d = await request(`/api/admin/applications${qs.toString() ? `?${qs}` : ''}`);
      setRows(Array.isArray(d?.data) ? d.data : []);
    } catch {
      setError(t('adminContent.errors.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [request, opening, status, t]);

  useEffect(() => { load(); }, [load]);

  const openingName = useMemo(() => {
    const map = new Map(openings.map((o) => [o.id, isAr ? o.title_ar : o.title_en]));
    return (r) => (r.opening_id ? map.get(r.opening_id) || r.opening_title || t('adminApplications.deletedOpening') : t('adminApplications.general'));
  }, [openings, isAr, t]);

  const fmtDate = (iso) => new Date(iso).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const changeStatus = async (r, next) => {
    setBusyId(r.id);
    setError('');
    try {
      await request('/api/admin/applications', { method: 'PATCH', body: { id: r.id, status: next } });
      setRows((prev) => (status && next !== status ? prev.filter((x) => x.id !== r.id) : prev.map((x) => (x.id === r.id ? { ...x, status: next } : x))));
    } catch {
      setError(t('adminContent.errors.save_failed'));
    } finally {
      setBusyId(null);
    }
  };

  const openCv = async (r) => {
    // Open the tab synchronously (avoids popup blockers), then point it at the short-lived signed link.
    const win = window.open('', '_blank');
    setBusyId(r.id);
    setError('');
    try {
      const d = await request('/api/admin/applications', { method: 'POST', body: { action: 'cv', id: r.id } });
      if (win) { win.opener = null; win.location.href = d.url; } else window.location.assign(d.url);
    } catch {
      if (win) win.close();
      setError(t('adminApplications.cvError'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    const r = deleting;
    setDeleting(null);
    setBusyId(r.id);
    setError('');
    try {
      await request(`/api/admin/applications?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch {
      setError(t('adminContent.errors.save_failed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm" data-testid="manager-applications">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{t('adminApplications.title')} <span className="text-muted-foreground font-semibold">({rows.length})</span></h2>
          <p className="text-xs text-muted-foreground">{t('adminApplications.hint')}</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <select aria-label={t('adminApplications.filterOpening')} data-testid="filter-opening" value={opening} onChange={(e) => setOpening(e.target.value)} className={`${SELECT} flex-1 sm:flex-none min-w-0 max-w-full`}>
            <option value="">{t('adminApplications.allOpenings')}</option>
            <option value="general">{t('adminApplications.general')}</option>
            {openings.map((o) => <option key={o.id} value={o.id}>{isAr ? o.title_ar : o.title_en}</option>)}
          </select>
          <select aria-label={t('adminApplications.filterStatus')} data-testid="filter-status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${SELECT} flex-1 sm:flex-none`}>
            <option value="">{t('adminApplications.allStatuses')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`adminApplications.status.${s}`)}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700" role="alert">
          <span>{error}</span>
          <button type="button" onClick={load} className="inline-flex items-center gap-1 font-semibold cursor-pointer"><RefreshCw className="w-4 h-4" />{t('adminContent.retry')}</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <Inbox className="w-8 h-8 mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t(opening || status ? 'adminApplications.emptyFiltered' : 'adminApplications.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} data-testid="application-row" className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-bold text-foreground" dir="auto">{r.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-brand-navy">{openingName(r)}</span>
                    <span className="mx-1.5">·</span>
                    <time dateTime={r.created_at}>{fmtDate(r.created_at)}</time>
                  </p>
                </div>
                <span data-testid="application-status" className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[r.status] || STATUS_STYLE.new}`}>
                  {t(`adminApplications.status.${r.status}`)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <a href={`mailto:${r.email}`} dir="ltr" className="inline-flex items-center gap-2 text-foreground hover:text-brand-orange-700 min-w-0 max-w-full justify-self-start"><Mail className="w-4 h-4 shrink-0 text-brand-orange" aria-hidden="true" /><span className="truncate">{r.email}</span></a>
                <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} dir="ltr" className="inline-flex items-center gap-2 text-foreground hover:text-brand-orange-700 justify-self-start"><Phone className="w-4 h-4 shrink-0 text-brand-orange" aria-hidden="true" />{r.phone}</a>
                {r.city && <span className="inline-flex items-center gap-2 text-foreground"><MapPin className="w-4 h-4 shrink-0 text-brand-orange" aria-hidden="true" /><span dir="auto">{r.city}</span></span>}
                {r.profile_url && /^https?:\/\//i.test(r.profile_url) && (
                  <a href={r.profile_url} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="inline-flex items-center gap-2 text-foreground hover:text-brand-orange-700 min-w-0 max-w-full justify-self-start"><Link2 className="w-4 h-4 shrink-0 text-brand-orange" aria-hidden="true" /><span className="truncate">{r.profile_url}</span></a>
                )}
              </div>

              {r.message && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-semibold text-muted-foreground">{t('adminApplications.message')}</summary>
                  <p dir="auto" className="mt-2 p-3 rounded-lg bg-card border border-border whitespace-pre-line break-words">{r.message}</p>
                </details>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                <label className="sr-only" htmlFor={`status-${r.id}`}>{t('adminApplications.changeStatus')}</label>
                <select id={`status-${r.id}`} data-testid="status-select" value={r.status} disabled={busyId === r.id} onChange={(e) => changeStatus(r, e.target.value)} className={SELECT}>
                  {STATUSES.map((s) => <option key={s} value={s}>{t(`adminApplications.status.${s}`)}</option>)}
                </select>
                <button type="button" data-testid="open-cv" disabled={busyId === r.id} onClick={() => openCv(r)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-navy text-white text-sm font-bold hover:bg-brand-navy/90 cursor-pointer disabled:opacity-50">
                  <FileDown className="w-4 h-4" aria-hidden="true" />
                  {t('adminApplications.openCv')}
                </button>
                <button type="button" data-testid="delete-application" disabled={busyId === r.id} onClick={() => setDeleting(r)} className="ms-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-500/10 cursor-pointer disabled:opacity-50">
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                  {t('adminContent.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleting && <ConfirmDelete name={deleting.full_name} onCancel={() => setDeleting(null)} onConfirm={remove} />}
    </section>
  );
}
