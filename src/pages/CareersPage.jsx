import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, GraduationCap, MapPin, Send, ExternalLink, RefreshCw } from 'lucide-react';
import { PageShell, PageHeader } from '../components/PageShell';
import { usePageMeta } from '../hooks/usePageMeta';
import { supabase } from '../integrations/supabase/client';
import { ApplyDialog } from '../components/ApplyDialog';

// DEV-192 · /careers: jobs and training programmes Sard currently offers.
// Rows come from public.job_openings (published only, enforced by RLS).
// Apply: the opening's own link if it has one, otherwise the in-site form (ApplyDialog → /api/careers/apply).

const FILTERS = ['all', 'job', 'training'];
const APPLY_BTN = 'inline-flex items-center gap-2 px-5 py-2.5 bg-brand-orange text-brand-gray-light font-bold rounded-xl hover:bg-brand-orange-400 transition-colors text-sm';
const MISSING_TABLE = new Set(['PGRST205', '42P01']); // table not created yet → show the empty state

function OpeningCard({ opening, isAr, onApply }) {
  const { t, i18n } = useTranslation();
  const title = isAr ? opening.title_ar : opening.title_en;
  const description = isAr ? opening.description_ar : opening.description_en;
  const location = isAr ? opening.location_ar : opening.location_en;
  const isTraining = opening.kind === 'training';
  const KindIcon = isTraining ? GraduationCap : Briefcase;
  const external = Boolean(opening.apply_url);
  const closes = opening.closes_at
    ? new Date(opening.closes_at).toLocaleDateString(i18n.language?.startsWith('ar') ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <article className="p-6 rounded-2xl bg-card border border-border flex flex-col gap-4" data-testid="opening" data-kind={opening.kind}>
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            isTraining ? 'bg-brand-orange/15 text-brand-orange border-brand-orange/30' : 'bg-brand-navy/10 text-brand-navy border-brand-navy/30'
          }`}
        >
          <KindIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {t(isTraining ? 'careersPage.kindTraining' : 'careersPage.kindJob')}
        </span>
        {opening.work_mode && (
          <span className="text-xs font-semibold text-muted-foreground">{t(`careersPage.workMode.${opening.work_mode}`)}</span>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        {location && (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 shrink-0 text-brand-orange" aria-hidden="true" />
            {location}
          </p>
        )}
        {description && <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{description}</p>}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
        {closes ? <span className="text-xs text-muted-foreground">{t('careersPage.closes', { date: closes })}</span> : <span />}
        {external ? (
          <a href={opening.apply_url} target="_blank" rel="noopener noreferrer" className={APPLY_BTN}>
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
            {t('careersPage.apply')}
          </a>
        ) : (
          <button type="button" onClick={() => onApply(opening)} className={`${APPLY_BTN} cursor-pointer`}>
            <Send className="w-4 h-4" aria-hidden="true" />
            {t('careersPage.apply')}
          </button>
        )}
      </div>
    </article>
  );
}

export default function CareersPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  usePageMeta({ title: t('careersPage.metaTitle'), description: t('careersPage.subtitle') });

  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState('all');
  const [applyFor, setApplyFor] = useState(undefined); // undefined = closed, null = general, object = opening

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const { data, error: err } = await supabase
      .from('job_openings')
      .select('*')
      .eq('is_published', true)
      .order('display_order', { ascending: true });
    if (err) {
      if (MISSING_TABLE.has(err.code)) setOpenings([]);
      else { console.error('Error fetching openings:', err); setError(true); }
    } else {
      setOpenings(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    all: openings.length,
    job: openings.filter((o) => o.kind !== 'training').length,
    training: openings.filter((o) => o.kind === 'training').length,
  }), [openings]);

  const visible = filter === 'all' ? openings : openings.filter((o) => (filter === 'training' ? o.kind === 'training' : o.kind !== 'training'));

  return (
    <PageShell>
      <PageHeader title={t('careersPage.title')} subtitle={t('careersPage.subtitle')} />
      <div className="container mx-auto px-4 sm:px-6 max-w-5xl pb-16 space-y-8">

        {!loading && !error && openings.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label={t('careersPage.title')}>
            {FILTERS.map((f) => (
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
                {t(`careersPage.filter.${f}`)} <span className="opacity-70">({counts[f]})</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-busy="true">
            {[0, 1].map((i) => <div key={i} className="h-56 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted-foreground">{t('careersPage.error')}</p>
            <button type="button" onClick={load} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card font-semibold hover:border-brand-navy/40 cursor-pointer">
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              {t('careersPage.retry')}
            </button>
          </div>
        ) : openings.length === 0 ? (
          <div className="max-w-xl mx-auto text-center py-12 px-6 rounded-3xl bg-card border border-border space-y-4" data-testid="careers-empty">
            <span className="w-16 h-16 mx-auto rounded-2xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-brand-orange" aria-hidden="true" />
            </span>
            <h2 className="text-2xl font-bold text-foreground">{t('careersPage.emptyTitle')}</h2>
            <p className="text-muted-foreground leading-relaxed">{t('careersPage.emptyBody')}</p>
            <button type="button" onClick={() => setApplyFor(null)} className="inline-flex items-center gap-2 px-6 py-3 bg-brand-orange text-brand-gray-light font-bold rounded-xl hover:bg-brand-orange-400 transition-colors cursor-pointer">
              <Send className="w-4 h-4" aria-hidden="true" />
              {t('careersPage.sendCv')}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visible.map((o) => <OpeningCard key={o.id} opening={o} isAr={isAr} onApply={setApplyFor} />)}
            </div>
            <div className="text-center rounded-2xl bg-brand-gray-light border border-border p-6 space-y-3">
              <h2 className="text-lg font-bold text-foreground">{t('careersPage.noFitTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('careersPage.noFitBody')}</p>
              <button type="button" onClick={() => setApplyFor(null)} className="inline-flex items-center gap-2 font-semibold text-brand-orange-700 hover:underline cursor-pointer">
                <Send className="w-4 h-4" aria-hidden="true" />
                {t('careersPage.sendCv')}
              </button>
            </div>
          </>
        )}
      </div>
      {applyFor !== undefined && <ApplyDialog opening={applyFor} isAr={isAr} onClose={() => setApplyFor(undefined)} />}
    </PageShell>
  );
}
