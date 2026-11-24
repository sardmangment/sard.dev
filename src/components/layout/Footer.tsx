import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, MapPin, MessageCircle, Instagram, Linkedin, Facebook } from 'lucide-react';
import { SITE, whatsappUrl } from '@/config/site';

// CC-12: official channels only (C-A07…C-A16), from src/config/site.js — not from the
// contact_info/footer_links tables, which held unverified data. No Team link (C-G03). No X (C-A17).
const SOCIAL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  linkedin: Linkedin,
  facebook: Facebook,
};

interface FooterProps {
  companyName?: string;
  // Accepted for backward compatibility with existing callers; intentionally ignored.
  links?: unknown[];
  contactInfo?: unknown;
}

export const Footer = ({ companyName }: FooterProps) => {
  const { t, i18n } = useTranslation();
  const lang: 'ar' | 'en' = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const name = companyName || SITE.legalName[lang];

  const pageLinks = [
    { to: '/about', label: t('nav.about') },
    { to: '/projects', label: t('nav.projects') },
    { to: '/careers', label: t('nav.careers') },
    { to: '/collaborations', label: t('nav.collaborations') },
    { to: '/faq', label: t('nav.faq') },
    { to: '/contact', label: t('nav.contact') },
    { to: '/calendar', label: t('nav.calendar') },
  ];

  return (
    <footer className="bg-brand-gray-light text-foreground border-t border-brand-navy/15 py-12 transition-colors">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <h3 className="text-xl font-bold tracking-tight text-foreground">{name}</h3>
            <p className="text-sm text-brand-navy/85 leading-relaxed">{t('footer.tagline')}</p>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-brand-orange">{t('footer.pages')}</h4>
            <ul className="space-y-2 text-sm text-brand-navy/85">
              {pageLinks.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="hover:text-brand-orange-700 transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-brand-orange">{t('footer.contact')}</h4>
            <div className="space-y-2 text-sm text-brand-navy/85">
              <a href={`mailto:${SITE.email}`} className="flex items-center gap-2 hover:text-brand-orange-700 transition-colors">
                <Mail className="h-4 w-4 text-brand-orange-700 shrink-0" />
                <span>{SITE.email}</span>
              </a>
              <a href={`tel:${SITE.phone.tel}`} className="flex items-center gap-2 hover:text-brand-orange-700 transition-colors">
                <Phone className="h-4 w-4 text-brand-orange-700 shrink-0" />
                <span dir="ltr">{SITE.phone.intl}</span>
              </a>
              <a
                href={whatsappUrl(t('contactPage.whatsappPrefill'))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-brand-orange-700 transition-colors"
              >
                <MessageCircle className="h-4 w-4 text-brand-orange-700 shrink-0" />
                <span>{t('contactPage.whatsapp')}</span>
              </a>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-brand-orange-700 shrink-0 mt-0.5" />
                <span>{t('footer.address')}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-brand-orange">{t('footer.follow')}</h4>
            <div className="flex items-center gap-3">
              {SITE.social.map((s) => {
                const Icon = SOCIAL_ICONS[s.id];
                return (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center hover:border-brand-orange/50 transition-colors"
                  >
                    {Icon && <Icon className="h-4 w-4 text-brand-orange" />}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-brand-navy/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-brand-navy/85">
          <p>© {new Date().getFullYear()} {name}. {t('footer.rights')}</p>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="hover:text-brand-orange-700 transition-colors">{t('footer.privacy')}</Link>
            <Link to="/terms" className="hover:text-brand-orange-700 transition-colors">{t('footer.terms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
