import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { PageShell, PageHeader } from '../components/PageShell';
import { usePageMeta } from '../hooks/usePageMeta';
import { FAQ_CATEGORIES, visibleFaqIds } from '../content/faq';

// Renders "/calendar" inside an answer as a link.
function Answer({ text }) {
  const parts = text.split('/calendar');
  return (
    <p className="text-foreground/85 leading-relaxed">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <Link to="/calendar" className="text-brand-orange font-semibold hover:underline" dir="ltr">/calendar</Link>
          )}
        </span>
      ))}
    </p>
  );
}

function FaqItem({ id }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="rounded-2xl bg-card border border-border" data-faq={id}>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-4 p-5 text-start font-semibold text-foreground hover:text-brand-orange transition-colors cursor-pointer"
        >
          <span>{t(`faq.${id}.q`)}</span>
          <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h3>
      <div id={panelId} role="region" hidden={!open} className="px-5 pb-5">
        <Answer text={t(`faq.${id}.a`)} />
      </div>
    </div>
  );
}

// CC-23 · /faq (Section C answers, verbatim from the locale files).
export default function FaqPage() {
  const { t } = useTranslation();
  usePageMeta({ title: t('faqPage.metaTitle'), description: t('faqPage.subtitle') });
  const visible = new Set(visibleFaqIds());

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [...visible].map((id) => ({
      '@type': 'Question',
      name: t(`faq.${id}.q`),
      acceptedAnswer: { '@type': 'Answer', text: t(`faq.${id}.a`) },
    })),
  };

  return (
    <PageShell>
      <PageHeader title={t('faqPage.title')} subtitle={t('faqPage.subtitle')} />
      <div className="container mx-auto px-4 sm:px-6 max-w-3xl pb-16 space-y-10">
        {FAQ_CATEGORIES.map((cat) => {
          const items = cat.items.filter((id) => visible.has(id));
          if (items.length === 0) return null;
          return (
            <section key={cat.id} aria-labelledby={`faq-${cat.id}`}>
              <h2 id={`faq-${cat.id}`} className="text-xl sm:text-2xl font-bold mb-4">{t(`faqPage.categories.${cat.id}`)}</h2>
              <div className="space-y-3">
                {items.map((id) => <FaqItem key={id} id={id} />)}
              </div>
            </section>
          );
        })}
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
    </PageShell>
  );
}
