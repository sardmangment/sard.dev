import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Scale, Briefcase, Mail } from 'lucide-react';
import { PageShell, PageHeader } from '../components/PageShell';
import { usePageMeta } from '../hooks/usePageMeta';
import { SITE } from '../config/site';

const RECRUITMENT_SECTIONS = ['s1', 's2', 's3', 's4', 's5'];

// DEV-192 / DEV-194: how data sent through the /careers application form is handled. Factual description
// of what the site does today; shown on /privacy below the interim notice, at #recruitment.
function RecruitmentSection() {
  const { t } = useTranslation();
  return (
    <section id="recruitment" aria-labelledby="recruitment-title" data-testid="privacy-recruitment" className="scroll-mt-24 p-6 sm:p-8 rounded-2xl bg-card border border-border space-y-5">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center shrink-0">
          <Briefcase className="w-5 h-5 text-brand-orange" aria-hidden="true" />
        </span>
        <h2 id="recruitment-title" className="text-xl sm:text-2xl font-bold">{t('legal.recruitment.title')}</h2>
      </div>
      <p className="text-foreground/85 leading-relaxed">{t('legal.recruitment.intro')}</p>
      {RECRUITMENT_SECTIONS.map((k) => (
        <div key={k} className="space-y-1.5">
          <h3 className="font-bold text-foreground">{t(`legal.recruitment.${k}.title`)}</h3>
          <p className="text-foreground/85 leading-relaxed">{t(`legal.recruitment.${k}.body`)}</p>
        </div>
      ))}
      <a href={`mailto:${SITE.email}`} dir="ltr" className="inline-flex items-center gap-2 font-semibold text-brand-orange-700 hover:underline">
        <Mail className="w-4 h-4" aria-hidden="true" />
        {SITE.email}
      </a>
    </section>
  );
}

// CC-13 · /privacy and /terms show the approved interim notice (C-I02). This is NOT a policy and
// NOT a compliance statement; it is replaced once legal counsel approves the real documents (C-I01).
export default function LegalNoticePage({ kind }) {
  const { t } = useTranslation();
  const { hash } = useLocation();
  useEffect(() => {
    if (kind === 'privacy' && hash === '#recruitment') document.getElementById('recruitment')?.scrollIntoView();
  }, [kind, hash]);
  const title = kind === 'terms' ? t('legal.termsTitle') : t('legal.privacyTitle');
  usePageMeta({ title: `${title} | ${t('brand.shortName')}`, description: t('legal.underReviewBody'), noindex: true });

  return (
    <PageShell>
      <PageHeader title={title} />
      <section className="container mx-auto px-4 sm:px-6 max-w-2xl pb-16 space-y-8">
        <div role="status" className="p-6 sm:p-8 rounded-2xl bg-card border border-border text-center space-y-4">
          <Scale className="w-10 h-10 text-brand-orange mx-auto" aria-hidden="true" />
          <h2 className="text-xl sm:text-2xl font-bold">{t('legal.underReviewTitle')}</h2>
          <p className="text-foreground/85 leading-relaxed">{t('legal.underReviewBody')}</p>
          <Link to="/contact" className="inline-block font-semibold text-brand-orange hover:underline">
            {t('legal.contactLink')}
          </Link>
        </div>
        {kind === 'privacy' && <RecruitmentSection />}
      </section>
    </PageShell>
  );
}
