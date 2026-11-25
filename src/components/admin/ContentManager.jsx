import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Upload, X, RefreshCw, ImageOff } from 'lucide-react';
import { CONTENT_TYPES, emptyRecord } from '../../config/adminContentSchema';

// DEV-194: list / add / edit / hide / reorder / delete for one content type (projects, openings, collaborations).
// All calls go through `request` (AdminPage): same-origin, session cookie, CSRF header with one retry.

const INPUT = 'w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-brand-orange';
const BTN_ICON = 'p-2 rounded-lg border border-border bg-card hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

function Modal({ title, onClose, children, testId }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-3 sm:p-6 overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} data-testid={testId} className="my-auto w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary cursor-pointer" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ImageField({ field, value, onChange, folder, request }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file) => {
    if (!file) return;
    setError('');
    if (file.size > 2 * 1024 * 1024) { setError(t('adminContent.errors.image_too_large')); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('folder', folder);
      fd.append('file', file);
      const data = await request('/api/admin/upload', { method: 'POST', form: fd });
      onChange(data.url);
    } catch (err) {
      setError(t(`adminContent.errors.${err.code}`, { defaultValue: t('adminContent.errors.upload_failed') }));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 shrink-0 rounded-xl border border-border bg-white flex items-center justify-center overflow-hidden">
          {value ? <img src={value} alt="" className="max-w-full max-h-full object-contain" /> : <ImageOff className="w-6 h-6 text-muted-foreground" aria-hidden="true" />}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card text-sm font-semibold hover:border-brand-orange/50 cursor-pointer disabled:opacity-50">
            <Upload className="w-4 h-4 text-brand-orange" aria-hidden="true" />
            {busy ? t('adminContent.uploading') : t('adminContent.upload')}
          </button>
          {value && (
            <button type="button" onClick={() => onChange('')} className="px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-500/10 cursor-pointer">{t('adminContent.removeImage')}</button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" data-testid={`upload-${field.name}`} onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <input type="text" dir="ltr" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="https://…" className={INPUT} aria-label={t(`adminContent.fields.${field.name}`)} />
      <p className="text-xs text-muted-foreground">{t('adminContent.imageHint')}</p>
      {error && <p className="text-xs text-red-600 font-semibold" role="alert">{error}</p>}
    </div>
  );
}

function Editor({ type, record, onClose, onSaved, request }) {
  const { t } = useTranslation();
  const def = CONTENT_TYPES[type];
  const isNew = !record.id;
  const [values, setValues] = useState(() => {
    const base = emptyRecord(type);
    for (const f of def.fields) if (record[f.name] !== undefined && record[f.name] !== null) base[f.name] = record[f.name];
    return base;
  });
  const [fieldErrors, setFieldErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (name, v) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const missing = def.fields.filter((f) => f.required && !String(values[f.name] ?? '').trim()).map((f) => f.name);
    setFieldErrors(missing);
    if (missing.length) return;
    setSaving(true);
    setError('');
    try {
      const payload = {};
      for (const f of def.fields) payload[f.name] = f.type === 'bool' ? Boolean(values[f.name]) : (values[f.name] ?? '');
      if (isNew) await request(`/api/admin/content?type=${type}`, { method: 'POST', body: payload });
      else await request(`/api/admin/content?type=${type}`, { method: 'PATCH', body: { id: record.id, ...payload } });
      onSaved();
    } catch (err) {
      if (err.fields) setFieldErrors(err.fields);
      setError(t('adminContent.errors.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t(isNew ? `adminContent.${type}.add` : `adminContent.${type}.edit`)} onClose={onClose} testId="content-editor">
      <form onSubmit={submit} noValidate className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {def.fields.map((f) => {
            const id = `f-${f.name}`;
            const invalid = fieldErrors.includes(f.name);
            const label = (
              <label htmlFor={id} className="block text-xs font-semibold text-foreground mb-1">
                {t(`adminContent.fields.${f.name}`)}{f.required && <span className="text-red-600"> *</span>}
              </label>
            );
            const wide = f.type === 'textarea' || f.type === 'image' || f.type === 'bool';
            let control;
            if (f.type === 'textarea') {
              control = <textarea id={id} rows={4} dir={f.dir} maxLength={f.max} value={values[f.name] || ''} onChange={(e) => set(f.name, e.target.value)} className={INPUT} aria-invalid={invalid} />;
            } else if (f.type === 'enum') {
              control = (
                <select id={id} value={values[f.name] || ''} onChange={(e) => set(f.name, e.target.value)} className={INPUT} aria-invalid={invalid}>
                  {!f.required && <option value="">—</option>}
                  {f.options.map((o) => <option key={o} value={o}>{t(`adminContent.options.${o}`)}</option>)}
                </select>
              );
            } else if (f.type === 'bool') {
              return (
                <label key={f.name} className="sm:col-span-2 flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/40 cursor-pointer">
                  <input id={id} type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} className="w-4 h-4 accent-brand-orange" />
                  <span className="text-sm font-semibold">{t(`adminContent.fields.${f.name}`)}</span>
                </label>
              );
            } else if (f.type === 'image') {
              control = <ImageField field={f} value={values[f.name]} onChange={(v) => set(f.name, v)} folder={def.uploadFolder} request={request} />;
            } else {
              control = (
                <input
                  id={id}
                  type={f.type === 'date' ? 'date' : f.type === 'url' ? 'url' : 'text'}
                  dir={f.type === 'url' ? 'ltr' : f.dir}
                  maxLength={f.max}
                  value={values[f.name] || ''}
                  onChange={(e) => set(f.name, e.target.value)}
                  className={INPUT}
                  aria-invalid={invalid}
                  placeholder={f.type === 'url' ? 'https://' : undefined}
                />
              );
            }
            return (
              <div key={f.name} className={wide ? 'sm:col-span-2' : ''}>
                {label}
                {control}
                {invalid && <p className="text-xs text-red-600 mt-1" role="alert">{t('adminContent.fieldInvalid')}</p>}
              </div>
            );
          })}
        </div>
        {error && <p className="text-sm text-red-600 font-semibold" role="alert">{error}</p>}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-secondary cursor-pointer">{t('adminContent.cancel')}</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl bg-brand-orange text-white text-sm font-bold hover:bg-brand-orange/90 cursor-pointer disabled:opacity-50">
            {saving ? t('adminContent.saving') : t('adminContent.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ContentManager({ type, request }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const def = CONTENT_TYPES[type];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | {} (new) | row
  const [deleting, setDeleting] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request(`/api/admin/content?type=${type}`);
      setRows(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setError(t('adminContent.errors.load_failed'));
    } finally {
      setLoading(false);
    }
  }, [request, type, t]);

  useEffect(() => { load(); }, [load]);

  const today = new Date().toISOString().slice(0, 10);
  const pickOf = (r, [ar, en]) => (isAr ? r[ar] : r[en]) || r[en] || r[ar];
  const titleOf = (r) => pickOf(r, def.titleFields);
  const subtitleOf = (r) => (def.subtitleFields ? pickOf(r, def.subtitleFields) : null);

  const act = async (id, fn) => {
    setBusyId(id);
    setError('');
    try { await fn(); await load(); } catch { setError(t('adminContent.errors.save_failed')); } finally { setBusyId(null); }
  };

  const toggle = (r) => act(r.id, () => request(`/api/admin/content?type=${type}`, { method: 'PATCH', body: { id: r.id, is_published: !r.is_published } }));
  const move = (index, delta) => {
    const ids = rows.map((r) => r.id);
    const j = index + delta;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    return act(rows[index].id, () => request(`/api/admin/content?type=${type}`, { method: 'PATCH', body: { order: ids } }));
  };
  const remove = async () => {
    const r = deleting;
    setDeleting(null);
    await act(r.id, () => request(`/api/admin/content?type=${type}&id=${encodeURIComponent(r.id)}`, { method: 'DELETE' }));
  };

  const badgeOf = (r) => {
    const f = def.fields.find((x) => x.type === 'enum' && x.required);
    return f && r[f.name] ? t(`adminContent.options.${r[f.name]}`) : null;
  };

  return (
    <section className="bg-card border border-border rounded-2xl p-4 sm:p-6 space-y-4 shadow-sm" data-testid={`manager-${type}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{t(`adminContent.${type}.title`)} <span className="text-muted-foreground font-semibold">({rows.length})</span></h2>
          <p className="text-xs text-muted-foreground">{t(`adminContent.${type}.hint`)}</p>
        </div>
        <button type="button" onClick={() => setEditing({})} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-orange text-white text-sm font-bold hover:bg-brand-orange/90 cursor-pointer">
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t(`adminContent.${type}.add`)}
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-700" role="alert">
          <span>{error}</span>
          <button type="button" onClick={load} className="inline-flex items-center gap-1 font-semibold cursor-pointer"><RefreshCw className="w-4 h-4" />{t('adminContent.retry')}</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3" aria-busy="true">{[0, 1].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t(`adminContent.${type}.empty`)}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r, i) => (
            <li key={r.id} data-testid="content-row" className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-3 ${r.is_published ? 'bg-secondary/30 border-border' : 'bg-muted/40 border-dashed border-border'}`}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {def.imageField && (
                  <div className="w-14 h-14 shrink-0 rounded-lg border border-border bg-white flex items-center justify-center overflow-hidden">
                    {r[def.imageField] ? <img src={r[def.imageField]} alt="" className="max-w-full max-h-full object-contain" /> : <ImageOff className="w-5 h-5 text-muted-foreground" aria-hidden="true" />}
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <p className={`font-bold truncate ${r.is_published ? 'text-foreground' : 'text-muted-foreground'}`}>{titleOf(r)}</p>
                  {subtitleOf(r) && <p className="text-xs text-muted-foreground truncate">{subtitleOf(r)}</p>}
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {badgeOf(r) && <span className="px-2 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy font-semibold">{badgeOf(r)}</span>}
                    {r.closes_at && r.closes_at < today && (
                      <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 font-semibold">{t('adminContent.expired')}</span>
                    )}
                    <span data-testid="row-visibility" className={`px-2 py-0.5 rounded-full font-semibold ${r.is_published ? 'bg-emerald-500/10 text-emerald-700' : 'bg-secondary text-muted-foreground'}`}>
                      {t(r.is_published ? 'adminContent.published' : 'adminContent.hidden')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <button type="button" className={BTN_ICON} disabled={i === 0 || busyId !== null} onClick={() => move(i, -1)} title={t('adminContent.moveUp')} aria-label={t('adminContent.moveUp')}><ArrowUp className="w-4 h-4" /></button>
                <button type="button" className={BTN_ICON} disabled={i === rows.length - 1 || busyId !== null} onClick={() => move(i, 1)} title={t('adminContent.moveDown')} aria-label={t('adminContent.moveDown')}><ArrowDown className="w-4 h-4" /></button>
                <button type="button" className={BTN_ICON} disabled={busyId !== null} onClick={() => toggle(r)} data-testid="toggle-visibility" title={t(r.is_published ? 'adminContent.hide' : 'adminContent.show')} aria-label={t(r.is_published ? 'adminContent.hide' : 'adminContent.show')}>
                  {r.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-emerald-700" />}
                </button>
                <button type="button" className={BTN_ICON} disabled={busyId !== null} onClick={() => setEditing(r)} data-testid="edit-row" title={t('adminContent.editAction')} aria-label={t('adminContent.editAction')}><Pencil className="w-4 h-4 text-brand-navy" /></button>
                <button type="button" className={BTN_ICON} disabled={busyId !== null} onClick={() => setDeleting(r)} data-testid="delete-row" title={t('adminContent.delete')} aria-label={t('adminContent.delete')}><Trash2 className="w-4 h-4 text-red-600" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <Editor type={type} record={editing} request={request} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}

      {deleting && (
        <Modal title={t('adminContent.deleteTitle')} onClose={() => setDeleting(null)} testId="delete-confirm">
          <div className="p-5 space-y-4">
            <p className="text-sm text-foreground">{t('adminContent.deleteBody', { name: titleOf(deleting) })}</p>
            <p className="text-xs text-muted-foreground">{t('adminContent.deleteHint')}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-secondary cursor-pointer">{t('adminContent.cancel')}</button>
              <button type="button" onClick={remove} data-testid="confirm-delete" className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 cursor-pointer">{t('adminContent.deleteConfirm')}</button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
