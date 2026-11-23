import { motion } from 'framer-motion';
import SplitText from './SplitText';
import { SiteNavbar } from './SiteNavbar';
import { useTranslation } from 'react-i18next';
import { Link } from "react-router-dom";   
import { 
  Calendar, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  Zap, 
  Home, 
  MessageSquare, 
  Sparkles, 
  Building2,
  FolderGit2
} from 'lucide-react';

export const HeroSection = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const homeLinks = [
    {
      to: '/projects',
      icon: FolderGit2,
      label_ar: 'المشاريع',
      label_en: 'Projects',
      className: 'hidden md:flex',
    },
    {
      to: '/calendar',
      icon: Calendar,
      label_ar: 'جدول المواعيد',
      label_en: 'Calendar',
      className: 'hidden sm:flex',
    },
  ];

  const homeDrawerLinks = [
    { to: '/', icon: Home, label_ar: 'الرئيسية', label_en: 'Home' },
    { to: '/projects', icon: FolderGit2, label_ar: 'المشاريع', label_en: 'Projects' },
    { to: '/calendar', icon: Calendar, label_ar: 'جدول المواعيد', label_en: 'Book Meeting' },
    { to: '/ai', icon: MessageSquare, label_ar: 'مساعد الذكاء الاصطناعي', label_en: 'Sard AI Chat' },
    { href: '#about', icon: Sparkles, label_ar: 'عن سرد', label_en: 'About Us', isSection: true },
    { href: '#services', icon: Zap, label_ar: 'خدماتنا', label_en: 'Our Services', isSection: true },
    { href: '#partners', icon: Building2, label_ar: 'شركاؤنا', label_en: 'Partners', isSection: true },
  ];

  const homeDrawerCta = {
    to: '/calendar',
    icon: Calendar,
    label_ar: t('hero.bookMeeting'),
    label_en: t('hero.bookMeeting'),
  };

  return (
    <>
      <SiteNavbar
        links={homeLinks}
        drawerLinks={homeDrawerLinks}
        drawerCta={homeDrawerCta}
      />

      <section className="min-h-[85vh] relative overflow-hidden bg-background text-foreground flex items-center justify-center py-8 transition-colors">
        <div className="container mx-auto px-4 sm:px-6 relative z-10 w-full">
          <div className="max-w-4xl mx-auto text-center space-y-6">

          {/* Hero Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-orange/15 border border-brand-orange/30 text-brand-orange text-xs sm:text-sm font-semibold shadow-sm"
          >
            <ShieldCheck className="w-4 h-4 shrink-0 text-brand-orange" />
            <span>{t('hero.badge')}</span>
          </motion.div>
          
          <div>
            <SplitText
              text={t('hero.title')}
              direction={isRTL ? "rtl" : "ltr"}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight"
            />
          </div>

          <div className="space-y-4 max-w-3xl mx-auto">
            <p className="text-foreground/80 text-base sm:text-lg md:text-xl leading-relaxed font-normal">
              {t('hero.description1')}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap gap-4 justify-center pt-2">

            {/* Book Meeting Button */}
            <Link to="/calendar">
              <motion.button
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 bg-brand-orange text-black font-bold rounded-xl shadow-lg shadow-brand-orange/25 flex items-center gap-3 text-base cursor-pointer hover:bg-brand-orange-400 transition-all"
              >
                <Calendar className="w-5 h-5" />
                <span>{t('hero.bookMeeting')}</span>
              </motion.button>
            </Link>

            {/* Ask AI Button */}
            <Link to="/ai">
              <motion.button
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 border-2 border-brand-orange text-brand-orange bg-brand-orange/10 flex items-center gap-3 font-bold rounded-xl hover:bg-brand-orange/20 transition-all text-base cursor-pointer shadow-sm"
              >
                <span>{t('hero.askAssistant')}</span>
                {isRTL ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
              </motion.button>
            </Link>
          </div>

        </div>
      </div>
    </section>
    </>
  );
};
