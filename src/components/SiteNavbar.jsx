import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Menu, X } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import sardLogo from '../assets/logo.png';
import { SITE_NAV } from '../config/navigation';

/**
 * SiteNavbar
 * Standard top navigation and mobile drawer across all public SARD pages (DEV-96).
 * Enhanced per UI/UX Pro Max and modern enterprise standards:
 * - Unified typography across all navigation elements
 * - Clean mobile header: Zero button-pill collisions with the brand logo
 * - Responsive breakpoints: Clean desktop nav + slide-out mobile drawer
 *
 * @param {Array} links Desktop links: [{ to, icon, label_ar, label_en, className }]
 * @param {Array} drawerLinks Drawer links: [{ to, href, icon, label_ar, label_en, isSection }]
 * @param {Object} drawerCta Optional drawer footer CTA: { to, icon, label_ar, label_en }
 * @param {boolean} sticky Optional sticky header (used for /ai)
 */
export function SiteNavbar({
  links = [],
  drawerLinks = [],
  drawerCta = null,
  sticky = false,
}) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const isRTL = i18n.language?.startsWith('ar') || (typeof document !== 'undefined' && document.documentElement.dir === 'rtl');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  // Page-specific drawer links first, then any site-wide link not already present.
  const pageMain = drawerLinks.filter((l) => !l.isSection);
  const mainDrawerLinks = [
    ...pageMain,
    ...SITE_NAV.filter((s) => !pageMain.some((l) => (l.to || l.href) === (s.to || s.href))).map((s) => ({
      to: s.to,
      href: s.href,
      label_ar: t(s.labelKey, { lng: 'ar' }),
      label_en: t(s.labelKey, { lng: 'en' }),
    })),
  ];
  const desktopSiteLinks = SITE_NAV.filter((s) => !s.drawerOnly);
  const sectionDrawerLinks = drawerLinks.filter((l) => l.isSection);

  return (
    <>
      <header
        className={`w-full border-b border-border/70 bg-background/90 backdrop-blur-md transition-colors ${
          sticky ? 'sticky top-0 z-30 shadow-xs' : 'relative z-20'
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-row items-center justify-between gap-4 h-16 sm:h-18">
            {/* Logo & Brand Wordmark */}
            <Link to="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
              <img
                src={sardLogo}
                alt="Sard"
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain transition-transform duration-200 group-hover:scale-105"
              />
              <span className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {t('brand.shortName')}
              </span>
            </Link>

            {/* Desktop Center Navigation Links */}
            <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1 xl:gap-2">
              {desktopSiteLinks.map((s) => {
                const isActive = location.pathname === s.to;
                const linkClass = `px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold tracking-wide transition-colors ${
                  isActive
                    ? 'text-brand-orange bg-brand-orange/10 font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`;
                return s.href ? (
                  <a key={s.href} href={s.href} className={linkClass}>
                    {t(s.labelKey)}
                  </a>
                ) : (
                  <Link key={s.to} to={s.to} className={linkClass}>
                    {t(s.labelKey)}
                  </Link>
                );
              })}
            </nav>

            {/* Actions: Page-specific links, Language Switcher, and Mobile Hamburger */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Page-specific desktop links: Hidden on mobile (< md) to avoid header collision */}
              {links.map((link) => {
                const Icon = link.icon;
                const isCta = link.to === '/calendar' || link.to === '/ai' || link.isCta;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 ${
                      isCta
                        ? 'bg-brand-orange text-white hover:bg-brand-orange/90 shadow-xs hover:shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-transparent hover:border-border/60'
                    } ${link.className || ''}`}
                  >
                    {Icon && <Icon className={`w-4 h-4 ${isCta ? 'text-white' : 'text-brand-orange'}`} />}
                    <span>{isRTL ? link.label_ar : link.label_en}</span>
                  </Link>
                );
              })}

              {/* Language Switcher */}
              <LanguageSwitcher />

              {/* Mobile Hamburger Menu (Hidden on md: >= 768px) */}
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                aria-label={isRTL ? "فتح قائمة التنقل" : "Open navigation menu"}
                aria-expanded={isDrawerOpen}
                className="md:hidden w-10 h-10 rounded-full border border-border/80 bg-secondary/60 hover:bg-secondary text-foreground flex items-center justify-center cursor-pointer transition-colors shadow-xs"
              >
                <Menu className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop with Click to Close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsDrawerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
              aria-hidden="true"
            />

            {/* Slide-out Drawer Panel */}
            <motion.aside
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className={`absolute top-0 bottom-0 ${
                isRTL ? 'right-0 border-l' : 'left-0 border-r'
              } w-[300px] max-w-[85vw] bg-card border-border p-6 flex flex-col justify-between shadow-2xl z-10 overflow-y-auto text-foreground`}
              role="dialog"
              aria-modal="true"
              aria-label={isRTL ? "قائمة التنقل" : "Navigation menu"}
            >
              <div className="space-y-6">
                {/* Header with logo & close button */}
                <div className="flex items-center justify-between border-b border-border/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <img src={sardLogo} alt="Sard" className="w-8 h-8 object-contain" />
                    <span className="font-bold text-foreground text-lg">{t('brand.shortName')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    aria-label={isRTL ? "إغلاق القائمة" : "Close menu"}
                    className="w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Primary Nav Links */}
                <nav className="flex flex-col space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-1">
                    {isRTL ? "الصفحات الرئيسية" : "Main Navigation"}
                  </span>

                  {mainDrawerLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = link.to && location.pathname === link.to;
                    const cls = `flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all font-medium text-sm min-h-[44px] ${
                      isActive
                        ? 'bg-brand-orange/15 text-brand-orange font-bold'
                        : 'text-foreground hover:bg-muted hover:text-brand-orange'
                    }`;
                    const body = (
                      <>
                        {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-brand-orange' : 'text-muted-foreground'}`} />}
                        <span>{isRTL ? link.label_ar : link.label_en}</span>
                      </>
                    );
                    return link.to ? (
                      <Link key={link.to} to={link.to} onClick={() => setIsDrawerOpen(false)} className={cls}>
                        {body}
                      </Link>
                    ) : (
                      <a key={link.href} href={link.href} onClick={() => setIsDrawerOpen(false)} className={cls}>
                        {body}
                      </a>
                    );
                  })}

                  {sectionDrawerLinks.length > 0 && (
                    <div className="pt-3 mt-2 border-t border-border/80">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 block mb-2">
                        {isRTL ? "أقسام الصفحة" : "Page Sections"}
                      </span>
                      {sectionDrawerLinks.map((section) => {
                        const Icon = section.icon;
                        return (
                          <a
                            key={section.href}
                            href={section.href}
                            onClick={() => setIsDrawerOpen(false)}
                            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm min-h-[44px]"
                          >
                            {Icon && <Icon className="w-4 h-4 text-brand-orange" />}
                            <span>{isRTL ? section.label_ar : section.label_en}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}
                </nav>
              </div>

              {/* Drawer Footer with Quick CTA */}
              <div className="pt-4 border-t border-border/80 space-y-3">
                {drawerCta && (
                  <Link
                    to={drawerCta.to}
                    onClick={() => setIsDrawerOpen(false)}
                    className="w-full py-3 px-4 bg-brand-orange text-white font-bold rounded-xl text-center text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-brand-orange/90 transition-colors min-h-[44px]"
                  >
                    {drawerCta.icon && <drawerCta.icon className="w-4 h-4" />}
                    <span>{isRTL ? drawerCta.label_ar : drawerCta.label_en}</span>
                  </Link>
                )}
                <div className="text-center text-[11px] text-muted-foreground">
                  © {new Date().getFullYear()} {t('brand.legalName')}
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default SiteNavbar;
