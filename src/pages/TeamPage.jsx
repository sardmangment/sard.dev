import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { User } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { PageShell, PageHeader } from '../components/PageShell';
import { usePageMeta } from '../hooks/usePageMeta';

// DEV-199 · /team: three sections managed from /admin → Team — founding partners, heads of departments, team.
// Public and linked from the navbar ("About Sard") and footer (manager's decision, replaces C-G03).
// Data comes only from the get_public_team RPC: published, active current members, approved fields only
// (name, title, photo). No contact details, no external links (C-G01). Alumni and interns are not shown.
const TEAM_TIERS = ['owner', 'manager', 'staff'];

async function fetchTeam() {
  const { data, error } = await supabase.rpc('get_public_team');
  if (error || !Array.isArray(data)) return [];
  // Before 20261125_dev199_team_page.sql the RPC has no tier: everyone falls into the team section.
  return data
    .filter((m) => !m.section || m.section === 'current')
    .map((m) => ({ ...m, tier: TEAM_TIERS.includes(m.tier) ? m.tier : 'staff' }));
}

function Avatar({ src, alt, size }) {
  return (
    <div className={`${size} shrink-0 rounded-full overflow-hidden bg-secondary border border-border`}>
      {src ? (
        <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <User className="w-1/3 h-1/3 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

// Owners: large cards. Department heads: medium cards. Team: compact cards. Rows are centred when not full.
const LAYOUT = {
  owner: {
    grid: 'flex flex-wrap justify-center gap-6',
    card: 'w-full sm:w-80 p-8 flex-col text-center',
    avatar: 'w-32 h-32 sm:w-36 sm:h-36',
    name: 'text-xl font-bold',
  },
  manager: {
    grid: 'flex flex-wrap justify-center gap-5',
    card: 'w-full sm:w-72 p-6 flex-col text-center',
    avatar: 'w-24 h-24',
    name: 'text-lg font-bold',
  },
  staff: {
    grid: 'flex flex-wrap justify-center gap-4',
    card: 'w-full sm:w-64 p-4 flex-row text-start',
    avatar: 'w-16 h-16',
    name: 'font-bold',
  },
};

const TITLE_KEY = { owner: 'team.ownersTitle', manager: 'team.managersTitle', staff: 'team.staffTitle' };

export default function TeamPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  const pick = (ar, en) => (isAr ? ar || en : en || ar) || '';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  usePageMeta({ title: `${t('team.metaTitle')} | ${t('brand.shortName')}`, description: t('team.intro') });

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

  const sections = TEAM_TIERS.map((tier) => ({ tier, members: rows.filter((m) => m.tier === tier) })).filter((s) => s.members.length);

  return (
    <PageShell>
      <PageHeader title={t('team.title')} subtitle={t('team.intro')} />
      {loading ? (
        <div className="py-16 text-center text-muted-foreground" role="status">…</div>
      ) : sections.length === 0 ? (
        <p className="container mx-auto px-4 py-16 text-center text-muted-foreground">{t('team.empty')}</p>
      ) : (
        sections.map(({ tier, members }) => {
          const L = LAYOUT[tier];
          return (
            <section key={tier} aria-labelledby={`team-${tier}`} data-testid={`team-section-${tier}`} className="container mx-auto px-4 sm:px-6 max-w-6xl py-8">
              <h2 id={`team-${tier}`} className="text-2xl sm:text-3xl font-bold mb-6 text-center">
                {t(TITLE_KEY[tier])}
              </h2>
              <div className={L.grid}>
                {members.map((m) => {
                  const name = pick(m.name_ar, m.name_en);
                  return (
                    <Link
                      key={m.id}
                      to={`/member/${m.id}`}
                      data-testid="team-card"
                      className={`${L.card} rounded-2xl bg-card border border-border flex items-center gap-4 hover:border-brand-orange/40 hover:shadow-sm transition-all`}
                    >
                      <Avatar src={m.photo_url} alt={name} size={L.avatar} />
                      <div className="min-w-0">
                        <h3 className={L.name}>{name}</h3>
                        <p className="text-sm text-muted-foreground">{pick(m.role_ar, m.role_en)}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </PageShell>
  );
}
