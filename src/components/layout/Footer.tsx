import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Phone, MapPin, ExternalLink, Instagram } from 'lucide-react';

interface FooterLink {
  id: string;
  title_ar: string;
  title_en: string;
  url: string;
  icon?: string;
}

interface ContactInfo {
  email?: string;
  phone?: string;
  address_ar?: string;
  address_en?: string;
  whatsapp?: string;
}

interface FooterProps {
  companyName?: string;
  links?: FooterLink[];
  contactInfo?: ContactInfo;
}

export const Footer = ({ companyName, links = [], contactInfo }: FooterProps) => {
  const { t } = useLanguage();
  const name = companyName || t('سرد للذكاء الاصطناعي', 'Sard AI');

  const [internalLinks, setInternalLinks] = useState<FooterLink[]>(links);
  const [internalContact, setInternalContact] = useState<ContactInfo | undefined>(contactInfo);

  useEffect(() => {
    if (links.length > 0) setInternalLinks(links);
  }, [links]);

  useEffect(() => {
    if (contactInfo) setInternalContact(contactInfo);
  }, [contactInfo]);

  // Self-fetch verified data if mounted without props (e.g. standalone on homepage)
  useEffect(() => {
    if (links.length === 0 && !contactInfo) {
      Promise.allSettled([
        supabase.from('footer_links').select('*').order('display_order', { ascending: true }),
        supabase.from('contact_info').select('*').limit(1).single()
      ]).then(([linksRes, contactRes]) => {
        if (linksRes.status === 'fulfilled' && linksRes.value.data) {
          setInternalLinks(linksRes.value.data as FooterLink[]);
        }
        if (contactRes.status === 'fulfilled' && contactRes.value.data) {
          setInternalContact(contactRes.value.data as ContactInfo);
        }
      }).catch((e) => {
        console.error('Footer fallback fetch error:', e);
      });
    }
  }, []);

  // Filter links to verified safe URLs only, explicitly excluding any unapproved/team routes
  const verifiedLinks = internalLinks.filter((link) => {
    if (!link.url || link.url.includes('/team')) return false;
    return link.url.startsWith('http://') || link.url.startsWith('https://');
  });

  return (
    <footer className="bg-secondary/40 text-foreground border-t border-border py-12 transition-colors">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div className="space-y-3">
            <h3 className="text-xl font-bold tracking-tight text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t(
                'حلول الذكاء الاصطناعي المتقدمة وأتمتة العمليات لتمكين المؤسسات والشركات.',
                'Advanced Artificial Intelligence and Process Automation solutions empowering modern enterprises.'
              )}
            </p>
          </div>

          {/* Contact Info (Decision D-08: Verified official details only) */}
          {internalContact && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-brand-orange">
                {t('تواصل معنا', 'Contact Us')}
              </h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                {internalContact.email && (
                  <a
                    href={`mailto:${internalContact.email}`}
                    className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                  >
                    <Mail className="h-4 w-4 text-brand-orange shrink-0" />
                    <span>{internalContact.email}</span>
                  </a>
                )}
                {internalContact.phone && (
                  <a
                    href={`tel:${internalContact.phone}`}
                    className="flex items-center gap-2 hover:text-brand-orange transition-colors"
                  >
                    <Phone className="h-4 w-4 text-brand-orange shrink-0" />
                    <span dir="ltr">{internalContact.phone}</span>
                  </a>
                )}
                {(internalContact.address_ar || internalContact.address_en) && (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-brand-orange shrink-0 mt-0.5" />
                    <span>{t(internalContact.address_ar || '', internalContact.address_en || '')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick & Verified Social Links (Decision D-07: Privacy/Terms hidden until approved text exists) */}
          {verifiedLinks.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-brand-orange">
                {t('روابط موثقة', 'Verified Links')}
              </h4>
              <div className="space-y-2">
                {verifiedLinks.map((link) => {
                  const isInstagram = link.url.includes('instagram.com') || link.title_en?.toLowerCase().includes('instagram');
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-brand-orange transition-colors"
                    >
                      {isInstagram ? (
                        <Instagram className="h-4 w-4 text-brand-orange" />
                      ) : (
                        <ExternalLink className="h-4 w-4 text-brand-orange" />
                      )}
                      <span>{t(link.title_ar, link.title_en)}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Copyright notice */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} {name}. {t('جميع الحقوق محفوظة', 'All rights reserved.')}</p>
          <div className="flex items-center gap-6">
            <span className="text-muted-foreground/60">{t('الإسكندرية', 'Alexandria')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
