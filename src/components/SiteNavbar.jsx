import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Menu, X, Calendar, MessageSquare, ChevronDown } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import sardLogo from '../assets/logo.png';
import { SITE_NAV } from '../config/navigation';

const desktopLinkClass = (active) =>
  `px-2 lg:px-3 py-1.5 rounded-lg text-xs xl:text-sm font-semibold tracking-wide whitespace-nowrap transition-colors ${
    active ? 'text-brand-orange bg-brand-orange/10 font-bold' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
  }`;

/**
 * DEV-199: desktop dropdown for a SITE_NAV group ("About Sard"). Opens on click (works on touch),
 * closes on Escape (focus back to the button), outside click and navigation. Arrow keys move between items.
 */
function NavDropdown({ group, pathname }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const active = group.children.some((c) => c.to === pathname);
  const menuId = `nav-menu-${group.id}`;

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const items = [...(rootRef.current?.querySelectorAll('[role="menuitem"]') || [])];
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
      items[next].focus();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        data-testid={`nav-group-${group.id}`}
        onClick={() => setOpen((o) => !o)}
        className={`${desktopLinkClass(active)} inline-flex items-center gap-1 cursor-pointer`}
      >
        {t(group.labelKey)}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t(group.labelKey)}
          className="absolute top-full mt-2 start-0 z-40 min-w-48 p-1.5 rounded-xl border border-border bg-card shadow-lg"
        >
          {group.children.map((c) => {
            const isActive = c.to === pathname;
            return (
              <Link
                key={c.to}
                to={c.to}
                role="menuitem"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                  isActive ? 'text-brand-orange bg-brand-orange/10' : 'text-foreground hover:bg-secondary/70 hover:text-brand-orange'
                }`}
              >
                {t(c.labelKey)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  // Drawer groups start expanded when the current page is inside them.
  const [openGroups, setOpenGroups] = useState(() =>
    SITE_NAV.filter((s) => s.children?.some((c) => c.to === location.pathname)).map((s) => s.id)
  );
  const toggleGroup = (id) => setOpenGroups((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));

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

  // Unified navigation: the same site-wide links on every page (SITE_NAV is the single source).
  // `links` and non-section `drawerLinks` from pages are accepted for compatibility but no longer
  // change the header; only in-page section anchors (isSection) are added to the drawer.
  void links;
  const toDrawerLink = (s) => ({
    to: s.to,
    href: s.href,
    label_ar: t(s.labelKey, { lng: 'ar' }),
    label_en: t(s.labelKey, { lng: 'en' }),
  });
  const mainDrawerLinks = SITE_NAV.map((s) =>
    s.children
      ? { group: s.id, label_ar: t(s.labelKey, { lng: 'ar' }), label_en: t(s.labelKey, { lng: 'en' }), children: s.children.map(toDrawerLink) }
      : toDrawerLink(s)
  );
  const desktopSiteLinks = SITE_NAV.filter((s) => !s.drawerOnly);
  const sectionDrawerLinks = drawerLinks.filter((l) => l.isSection);
  const cta = drawerCta || { to: '/calendar', icon: Calendar, label_ar: t('nav.calendar', { lng: 'ar' }), label_en: t('nav.calendar', { lng: 'en' }) };

  return (
    <>
      <header
        className={`w-full border-b border-border/70 bg-background/90 backdrop-blur-md transition-colors ${
          sticky ? 'sticky top-0 z-30 shadow-xs' : 'relative z-20'
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-row items-center justify-between gap-4 h-16 sm:h-18">
            {/* Logo */}
            <Link to="/" aria-label={t('brand.shortName')} className="flex items-center group shrink-0">
              <img
                src={sardLogo}
                alt="Sard"
                className="h-8 sm:h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
              />
            </Link>

            {/* Desktop Center Navigation Links */}
            <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1 xl:gap-2">
              {desktopSiteLinks.map((s) => {
                if (s.children) return <NavDropdown key={s.id} group={s} pathname={location.pathname} />;
                const linkClass = desktopLinkClass(location.pathname === s.to);
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
              {/* Site-wide actions: identical on every page (hidden on mobile; available in the drawer) */}
              {/* DEV-193/199: the two pills show icon-only at medium widths (label kept for screen readers) */}
              <Link
                to="/ai"
                title={t('nav.ai')}
                className={`hidden lg:inline-flex items-center gap-2 px-2.5 xl:px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors border ${
                  location.pathname === '/ai'
                    ? 'border-brand-orange/40 text-brand-orange bg-brand-orange/10'
                    : 'border-border/70 text-foreground hover:bg-secondary/60'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-brand-orange" aria-hidden="true" />
                <span className="sr-only xl:not-sr-only">{t('nav.ai')}</span>
              </Link>
              <Link
                to="/calendar"
                title={t('nav.calendar')}
                className="hidden md:inline-flex items-center gap-2 px-2.5 lg:px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap bg-brand-orange text-white hover:bg-brand-orange/90 shadow-xs hover:shadow-sm transition-colors"
              >
                <Calendar className="w-4 h-4 text-white" aria-hidden="true" />
                <span className="sr-only lg:not-sr-only">{t('nav.calendar')}</span>
              </Link>

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
                  <img src={sardLogo} alt="Sard" className="h-7 w-auto object-contain" />
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
                    if (link.children) {
                      const expanded = openGroups.includes(link.group);
                      const groupActive = link.children.some((c) => c.to === location.pathname);
                      return (
                        <div key={link.group}>
                          <button
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={`drawer-${link.group}`}
                            data-testid={`drawer-group-${link.group}`}
                            onClick={() => toggleGroup(link.group)}
                            className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl transition-all font-medium text-sm min-h-[44px] cursor-pointer ${
                              groupActive ? 'text-brand-orange font-bold' : 'text-foreground hover:bg-muted hover:text-brand-orange'
                            }`}
                          >
                            <span>{isRTL ? link.label_ar : link.label_en}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                          </button>
                          {expanded && (
                            <div id={`drawer-${link.group}`} className="ms-4 ps-2 border-s border-border/80 space-y-1">
                              {link.children.map((c) => (
                                <Link
                                  key={c.to}
                                  to={c.to}
                                  onClick={() => setIsDrawerOpen(false)}
                                  className={`flex items-center px-3.5 py-2.5 rounded-xl text-sm min-h-[44px] transition-colors ${
                                    location.pathname === c.to ? 'bg-brand-orange/15 text-brand-orange font-bold' : 'text-foreground hover:bg-muted hover:text-brand-orange'
                                  }`}
                                >
                                  {isRTL ? c.label_ar : c.label_en}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }
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
                <Link
                  to={cta.to}
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-full py-3 px-4 bg-brand-orange text-white font-bold rounded-xl text-center text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-brand-orange/90 transition-colors min-h-[44px]"
                >
                  {cta.icon && <cta.icon className="w-4 h-4" />}
                  <span>{isRTL ? cta.label_ar : cta.label_en}</span>
                </Link>
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
