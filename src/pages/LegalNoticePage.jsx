import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Scale } from 'lucide-react';
import { PageShell, PageHeader } from '../components/PageShell';
import { usePageMeta } from '../hooks/usePageMeta';

// CC-13 · /privacy and /terms show the approved interim notice (C-I02). This is NOT a policy and
// NOT a compliance statement; it is replaced once legal counsel approves the real documents (C-I01).
export default function LegalNoticePage({ kind }) {
  const { t } = useTranslation();
  const title = kind === 'terms' ? t('legal.termsTitle') : t('legal.privacyTitle');
  usePageMeta({ title: `${title} | ${t('brand.shortName')}`, description: t('legal.underReviewBody'), noindex: true });

  return (
    <PageShell>
      <PageHeader title={title} />
      <section className="container mx-auto px-4 sm:px-6 max-w-2xl pb-16">
        <div role="status" className="p-6 sm:p-8 rounded-2xl bg-card border border-border text-center space-y-4">
          <Scale className="w-10 h-10 text-brand-orange mx-auto" aria-hidden="true" />
          <h2 className="text-xl sm:text-2xl font-bold">{t('legal.underReviewTitle')}</h2>
          <p className="text-foreground/85 leading-relaxed">{t('legal.underReviewBody')}</p>
          <Link to="/contact" className="inline-block font-semibold text-brand-orange hover:underline">
            {t('legal.contactLink')}
          </Link>
        </div>
      </section>
    </PageShell>
  );
}
