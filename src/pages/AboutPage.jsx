import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Calendar } from 'lucide-react';
import { PageShell, PageHeader } from '../components/PageShell';
import { usePageMeta } from '../hooks/usePageMeta';
import { PILLARS, SERVICES, VALUE_KEYS } from '../content/services';

function Section({ id, title, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="container mx-auto px-4 sm:px-6 py-8 sm:py-10 max-w-5xl">
      <h2 id={`${id}-title`} className="text-2xl sm:text-3xl font-bold text-foreground mb-5">{title}</h2>
      {children}
    </section>
  );
}

// CC-22 · /about (C-H01). Must not link to team, alumni or intern pages (C-H02).
export default function AboutPage() {
  const { t } = useTranslation();
  usePageMeta({ title: t('aboutPage.metaTitle'), description: t('aboutPage.metaDescription') });

  return (
    <PageShell>
      <PageHeader title={t('about.title')} subtitle={t('brand.tagline')} />

      <Section id="story" title={t('aboutPage.storyTitle')}>
        <div className="space-y-4 text-base sm:text-lg text-foreground/85 leading-relaxed">
          <p>{t('about.paragraph1')}</p>
          <p>{t('about.paragraph2')}</p>
          <p>{t('about.paragraph3')}</p>
        </div>
      </Section>

      <div className="container mx-auto px-4 sm:px-6 max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
        <article aria-labelledby="mission-title" className="p-6 sm:p-8 rounded-2xl bg-card border border-border">
          <h2 id="mission-title" className="text-xl sm:text-2xl font-bold mb-3">{t('aboutPage.missionTitle')}</h2>
          <p className="text-foreground/85 leading-relaxed">{t('mission.text')}</p>
        </article>
        <article aria-labelledby="vision-title" className="p-6 sm:p-8 rounded-2xl bg-card border border-border">
          <h2 id="vision-title" className="text-xl sm:text-2xl font-bold mb-3">{t('aboutPage.visionTitle')}</h2>
          <p className="text-foreground/85 leading-relaxed">{t('vision.paragraph1')}</p>
        </article>
      </div>

      <Section id="values" title={t('aboutPage.valuesTitle')}>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="about-values">
          {VALUE_KEYS.map((key, i) => (
            <li key={key} className="p-5 rounded-2xl bg-card border border-border">
              <div className="text-brand-orange font-bold text-sm mb-1">{String(i + 1).padStart(2, '0')}</div>
              <h3 className="font-bold text-lg mb-2">{t(`values.${key}.title`)}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t(`values.${key}.description`)}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="pillars" title={t('aboutPage.pillarsTitle')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PILLARS.map((p) => (
            <div key={p} className="p-5 rounded-2xl bg-card border border-border">
              <h3 className="font-extrabold tracking-wider text-brand-orange">{t(`services.pillars.${p}.title`)}</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-3">{t(`services.pillars.${p}.description`)}</p>
              <ul className="space-y-1 text-sm text-foreground/85 list-disc ps-5">
                {SERVICES.filter((s) => s.pillar === p).map((s) => (
                  <li key={s.id}>{t(`services.items.${s.id}.title`)}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id="how" title={t('aboutPage.howTitle')}>
        <p className="text-base sm:text-lg text-foreground/85 leading-relaxed">{t('aboutPage.howBody')}</p>
        <a href="/#services" className="inline-block mt-4 font-semibold text-brand-orange hover:underline">
          {t('aboutPage.servicesLink')}
        </a>
      </Section>

      <section className="container mx-auto px-4 sm:px-6 max-w-5xl py-10">
        <div className="p-6 sm:p-10 rounded-2xl bg-brand-orange/10 border border-brand-orange/30 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">{t('aboutPage.ctaTitle')}</h2>
          <p className="text-foreground/80 mb-6">{t('aboutPage.ctaBody')}</p>
          <Link to="/calendar" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-orange text-black font-bold rounded-xl hover:bg-brand-orange-400 transition-colors">
            <Calendar className="w-5 h-5" />
            {t('hero.bookMeeting')}
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
