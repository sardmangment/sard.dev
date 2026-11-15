import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import defaultLogo from '@/assets/logo.png';

interface NavbarProps {
  logoUrl?: string;
  companyName?: string;
}

export const Navbar = ({ logoUrl, companyName }: NavbarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { language, setLanguage, t, isRTL } = useLanguage();
  const location = useLocation();

  const brandName = companyName || t('سرد للذكاء الاصطناعي', 'Sard AI');
  const activeLogo = logoUrl || defaultLogo;

  const navLinks = [
    { href: '/', label: t('الرئيسية', 'Home') },
    { href: '/#about', label: t('من نحن', 'About') },
    { href: '/#services', label: t('خدماتنا', 'Services') },
    { href: '/#partners', label: t('شركاؤنا', 'Partners') },
    { href: '/projects', label: t('المشاريع', 'Projects') },
    { href: '/calendar', label: t('حجز موعد', 'Book a Meeting') },
    { href: '/ai', label: t('المساعد الذكي', 'AI Assistant') },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-md border-b border-border text-foreground transition-colors">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src={activeLogo} alt={brandName} className="h-9 w-auto object-contain transition-transform group-hover:scale-105" />
            <span className="text-lg sm:text-xl font-bold tracking-wide text-foreground">
              {brandName}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => {
              const isHash = link.href.includes('#');
              if (isHash) {
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-muted-foreground hover:text-brand-orange transition-colors"
                  >
                    {link.label}
                  </a>
                );
              }
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`text-sm font-medium transition-colors ${
                    isActive ? 'text-brand-orange font-bold' : 'text-muted-foreground hover:text-brand-orange'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Language Switcher & Mobile Menu Trigger */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="gap-2 text-xs font-semibold border-border hover:bg-muted"
            >
              <Globe className="h-3.5 w-3.5 text-brand-orange" />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-foreground hover:bg-muted"
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
            >
              {isOpen ? <X className="h-5 w-5 text-brand-orange" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Drawer Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden overflow-hidden border-t border-border bg-card/95 backdrop-blur-md rounded-b-2xl shadow-xl"
            >
              <div className="py-4 px-2 space-y-1">
                {navLinks.map((link) => {
                  const isHash = link.href.includes('#');
                  if (isHash) {
                    return (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={() => setIsOpen(false)}
                        className="block px-4 py-2.5 rounded-xl text-sm font-medium text-foreground/80 hover:text-brand-orange hover:bg-muted transition-colors"
                      >
                        {link.label}
                      </a>
                    );
                  }
                  const isActive = location.pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setIsOpen(false)}
                      className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-brand-orange/10 text-brand-orange font-bold'
                          : 'text-foreground/80 hover:text-brand-orange hover:bg-muted'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

export default Navbar;
