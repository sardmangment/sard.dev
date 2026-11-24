import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, MessageCircle, MapPin, Clock, Calendar, Share2, Instagram, Linkedin, Facebook } from 'lucide-react';
import { PageShell, PageHeader } from '../components/PageShell';
import { usePageMeta } from '../hooks/usePageMeta';
import { SITE, whatsappUrl } from '../config/site';

const SOCIAL_ICONS = { instagram: Instagram, linkedin: Linkedin, facebook: Facebook };

function Card({ icon, title, children }) {
  const Icon = icon;
  return (
    <div className="p-5 rounded-2xl bg-card border border-border flex items-start gap-4">
      <span className="w-11 h-11 shrink-0 rounded-xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center">
        <Icon className="w-5 h-5 text-brand-orange" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="font-bold text-foreground mb-1">{title}</h2>
        <div className="text-sm text-muted-foreground break-words">{children}</div>
      </div>
    </div>
  );
}

// CC-24 · /contact. All official channels (D-33). Primary action: book a discovery meeting.
// The contact form (CC-60…64) is not rendered: it needs a notification provider and legal sign-off (C-I03).
// The map (CC-25) renders only once verified coordinates exist in SITE.mapCoordinates (D-38).
export default function ContactPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');
  usePageMeta({ title: t('contactPage.metaTitle'), description: t('contactPage.subtitle') });

  return (
    <PageShell>
      <PageHeader title={t('contactPage.title')} subtitle={t('contactPage.subtitle')} />
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl pb-16 space-y-8">
        <div className="text-center">
          <Link
            to="/calendar"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-brand-orange text-brand-gray-light font-bold rounded-xl shadow-lg shadow-brand-orange/25 hover:bg-brand-orange-400 transition-colors"
          >
            <Calendar className="w-5 h-5" aria-hidden="true" />
            {t('contactPage.primaryCta')}
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card icon={Mail} title={t('contactPage.email')}>
            <a href={`mailto:${SITE.email}`} className="text-foreground hover:text-brand-orange">{SITE.email}</a>
          </Card>
          <Card icon={Phone} title={t('contactPage.phone')}>
            <a href={`tel:${SITE.phone.tel}`} dir="ltr" className="text-foreground hover:text-brand-orange">{SITE.phone.intl}</a>
          </Card>
          <Card icon={MessageCircle} title={t('contactPage.whatsapp')}>
            <a
              href={whatsappUrl(t('contactPage.whatsappPrefill'))}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground hover:text-brand-orange"
              data-testid="whatsapp-link"
            >
              {t('contactPage.whatsappAction')}
            </a>
          </Card>
          <Card icon={Clock} title={t('contactPage.hours')}>
            {t('contactPage.hoursValue')}
          </Card>
          <Card icon={MapPin} title={t('contactPage.location')}>
            <p>{isAr ? SITE.address.ar : SITE.address.en}</p>
            {isAr && <p className="mt-1">{SITE.detailedAddress.ar}</p>}
          </Card>
          <Card icon={Share2} title={t('contactPage.social')}>
            <div className="flex items-center gap-4 mt-1">
              {SITE.social.map((s) => {
                const Icon = SOCIAL_ICONS[s.id];
                return (
                  <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="text-foreground hover:text-brand-orange">
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </Card>
        </div>

        {SITE.mapCoordinates && (
          <iframe
            title={t('contactPage.location')}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-72 rounded-2xl border border-border"
            src={`https://www.google.com/maps?q=${SITE.mapCoordinates.lat},${SITE.mapCoordinates.lng}&output=embed`}
          />
        )}
      </div>
    </PageShell>
  );
}
