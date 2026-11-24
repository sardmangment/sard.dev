import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Handshake, ExternalLink, RefreshCw, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageShell, PageHeader } from '../components/PageShell';
import { usePageMeta } from '../hooks/usePageMeta';
import { supabase } from '../integrations/supabase/client';

// DEV-193 · /collaborations: entities, companies, institutions and businesses Sard collaborates with.
// Rows come from public.collaborations (published only, enforced by RLS). Separate from the home-page
// "Our Partners in Success" ribbon (public.partnerships).

const KINDS = ['academic', 'business', 'training', 'other'];
const MISSING_TABLE = new Set(['PGRST205', '42P01']); // table not created yet → show the empty state

const KIND_STYLE = {
  academic: 'bg-brand-navy/10 text-brand-navy border-brand-navy/30',
  business: 'bg-brand-orange/15 text-brand-orange-700 border-brand-orange/30',
  training: 'bg-emerald-500/10 text-emerald-700 border-emerald-600/30',
  other: 'bg-secondary text-muted-foreground border-border',
};

function CollaborationCard({ item, isAr }) {
  const { t, i18n } = useTranslation();
  const name = isAr ? item.name_ar : item.name_en;
  const description = isAr ? item.description_ar : item.description_en;
  const kind = KINDS.includes(item.kind) ? item.kind : 'other';
  const since = item.started_on
    ? new Date(item.started_on).toLocaleDateString(i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long' })
    : null;

  return (
    <article className="p-6 rounded-2xl bg-card border border-border flex flex-col gap-4" data-testid="collaboration" data-kind={kind}>
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 shrink-0 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden p-2">
          {item.logo_url ? (
            <img src={item.logo_url} alt={name} loading="lazy" className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-3xl font-bold text-brand-navy" aria-hidden="true">{name?.trim()?.charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <h2 className="text-lg font-bold text-foreground leading-snug">{name}</h2>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${KIND_STYLE[kind]}`}>
            {t(`collaborationsPage.kind.${kind}`)}
          </span>
        </div>
      </div>

      {description && <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{description}</p>}

      {(since || item.website_url) && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2 text-sm">
          {since ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <CalendarDays className="w-4 h-4 text-brand-orange" aria-hidden="true" />
              {t('collaborationsPage.since', { date: since })}
            </span>
          ) : <span />}
          {item.website_url && (
            <a href={item.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-brand-orange-700 hover:underline">
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              {t('collaborationsPage.visit')}
            </a>
          )}
        </div>
      )}
    </article>
  );
}

export default function CollaborationsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  usePageMeta({ title: t('collaborationsPage.metaTitle'), description: t('collaborationsPage.subtitle') });

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error: err } = await supabase
      .from('collaborations')
      .select('*')
      .eq('is_published', true)
      .order('display_order', { ascending: true });
    if (err) {
      if (MISSING_TABLE.has(err.code)) setItems([]);
      else { console.error('Error fetching collaborations:', err); setError(true); }
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Only show filters for kinds that actually have rows (and only when there is more than one kind).
  const filters = useMemo(() => {
    const present = KINDS.filter((k) => items.some((i) => (KINDS.includes(i.kind) ? i.kind : 'other') === k));
    return present.length > 1 ? ['all', ...present] : [];
  }, [items]);

  const countOf = (f) => (f === 'all' ? items.length : items.filter((i) => (KINDS.includes(i.kind) ? i.kind : 'other') === f).length);
  const visible = filter === 'all' ? items : items.filter((i) => (KINDS.includes(i.kind) ? i.kind : 'other') === filter);

  return (
    <PageShell>
      <PageHeader title={t('collaborationsPage.title')} subtitle={t('collaborationsPage.subtitle')} />
      <div className="container mx-auto px-4 sm:px-6 max-w-5xl pb-16 space-y-8">

        {!loading && !error && filters.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label={t('collaborationsPage.title')}>
            {filters.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors cursor-pointer ${
                  filter === f ? 'bg-brand-navy text-white border-brand-navy' : 'bg-card text-foreground border-border hover:border-brand-navy/40'
                }`}
              >
                {t(f === 'all' ? 'collaborationsPage.filterAll' : `collaborationsPage.kind.${f}`)} <span className="opacity-70">({countOf(f)})</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true">
            {[0, 1].map((i) => <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground">{t('collaborationsPage.error')}</p>
            <button type="button" onClick={load} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card font-semibold hover:border-brand-navy/40 cursor-pointer">
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              {t('collaborationsPage.retry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="max-w-xl mx-auto text-center py-12 px-6 rounded-3xl bg-card border border-border space-y-4" data-testid="collaborations-empty">
            <span className="w-16 h-16 mx-auto rounded-2xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center">
              <Handshake className="w-8 h-8 text-brand-orange" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-bold text-foreground">{t('collaborationsPage.emptyTitle')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('collaborationsPage.emptyBody')}</p>
            <Link to="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-orange text-brand-gray-light font-bold rounded-xl hover:bg-brand-orange-400 transition-colors">
              <Handshake className="w-4 h-4" aria-hidden="true" />
              {t('collaborationsPage.cta')}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visible.map((c) => <CollaborationCard key={c.id} item={c} isAr={isAr} />)}
            </div>
            <div className="text-center rounded-2xl bg-brand-gray-light border border-border p-6 space-y-3">
              <h2 className="text-lg font-bold text-foreground">{t('collaborationsPage.ctaTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('collaborationsPage.ctaBody')}</p>
              <Link to="/contact" className="inline-flex items-center gap-2 font-semibold text-brand-orange-700 hover:underline">
                <Handshake className="w-4 h-4" aria-hidden="true" />
                {t('collaborationsPage.cta')}
              </Link>
            </div>
          </>
        )}
      </div>
    </PageShell>
  );
}
