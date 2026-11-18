import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { PageShell, PageHeader } from '../components/PageShell';
import { usePageMeta } from '../hooks/usePageMeta';

// CC-53 · /team (D-35): public by direct link only — not in header, footer, /about or sitemap; noindex.
// Shows approved professional fields only (C-G01). Alumni and interns appear only with recorded consent
// (C-G05/C-G06), enforced server-side by the get_public_team RPC. No contact details, no external links.
async function fetchTeam() {
  const rpc = await supabase.rpc('get_public_team');
  if (!rpc.error && Array.isArray(rpc.data)) return rpc.data;
  // Fallback until migration 20261118_team_verification.sql is applied: current active members,
  // approved columns only. Alumni/interns need the consent columns, so they stay hidden.
  const { data } = await supabase
    .from('team_members')
    .select('id, name_ar, name_en, role_ar, role_en, photo_url, is_active, display_order')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return (data || []).map((m) => ({ ...m, section: 'current' }));
}

function Avatar({ src, alt }) {
  return (
    <div className="w-20 h-20 shrink-0 rounded-full overflow-hidden bg-secondary border border-border">
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <User className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

function Section({ id, title, intro, note, children, empty }) {
  return (
    <section aria-labelledby={id} className="container mx-auto px-4 sm:px-6 max-w-5xl py-8">
      <h2 id={id} className="text-2xl sm:text-3xl font-bold mb-2">{title}</h2>
      {intro && <p className="text-muted-foreground leading-relaxed mb-2 max-w-3xl">{intro}</p>}
      {note && <p className="text-xs text-muted-foreground mb-4 max-w-3xl">{note}</p>}
      {empty ? <p className="text-sm text-muted-foreground py-6">{empty}</p> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">{children}</div>}
    </section>
  );
}

export default function TeamPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const pick = (ar, en) => (isAr ? ar || en : en || ar) || '';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  usePageMeta({ title: `${t('team.metaTitle')} | ${t('brand.shortName')}`, noindex: true });

  useEffect(() => {
    let alive = true;
    fetchTeam()
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const current = rows.filter((r) => r.section === 'current');
  const alumni = rows.filter((r) => r.section === 'alumni');
  const interns = rows.filter((r) => r.section === 'intern');

  return (
    <PageShell>
      <PageHeader title={t('team.title')} subtitle={t('team.intro')} />
      {loading ? (
        <div className="py-16 text-center text-muted-foreground" role="status">…</div>
      ) : (
        <>
          <Section id="team-current" title={t('team.currentTitle')} empty={current.length ? null : t('team.empty')}>
            {current.map((m) => (
              <Link key={m.id} to={`/member/${m.id}`} className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4 hover:border-brand-orange/40 transition-colors">
                <Avatar src={m.photo_url} alt={pick(m.name_ar, m.name_en)} />
                <div>
                  <h3 className="font-bold">{pick(m.name_ar, m.name_en)}</h3>
                  <p className="text-sm text-muted-foreground">{pick(m.role_ar, m.role_en)}</p>
                </div>
              </Link>
            ))}
          </Section>

          <Section id="team-alumni" title={t('team.alumniTitle')} intro={t('team.alumniIntro')} empty={alumni.length ? null : t('team.empty')}>
            {alumni.map((m) => (
              <article key={m.id} className="p-5 rounded-2xl bg-card border border-border">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-brand-orange mb-2">{t('team.formerMember')}</span>
                <h3 className="font-bold">{pick(m.name_ar, m.name_en)}</h3>
                <p className="text-sm text-muted-foreground">{pick(m.former_role_ar, m.former_role_en)}</p>
                {pick(m.contribution_ar, m.contribution_en) && <p className="text-sm mt-2 leading-relaxed">{pick(m.contribution_ar, m.contribution_en)}</p>}
              </article>
            ))}
          </Section>

          <Section
            id="team-interns"
            title={t('team.internsTitle')}
            intro={`${t('team.internsTagline')} ${t('team.internsIntro')}`}
            note={t('team.internsNote')}
            empty={interns.length ? null : t('team.empty')}
          >
            {interns.map((m) => (
              <article key={m.id} className="p-5 rounded-2xl bg-card border border-border">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-brand-orange mb-2">
                  {m.intern_status === 'current' ? t('team.currentIntern') : t('team.completedInternship')}
                </span>
                <h3 className="font-bold">{pick(m.name_ar, m.name_en)}</h3>
                <p className="text-sm text-muted-foreground">{pick(m.internship_area_ar, m.internship_area_en)}</p>
                {pick(m.contribution_ar, m.contribution_en) && <p className="text-sm mt-2 leading-relaxed">{pick(m.contribution_ar, m.contribution_en)}</p>}
              </article>
            ))}
          </Section>
        </>
      )}
    </PageShell>
  );
}
