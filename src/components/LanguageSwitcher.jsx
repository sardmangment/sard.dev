import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { motion } from "framer-motion";

/**
 * LanguageSwitcher
 * Refined, accessible language toggle inspired by enterprise design systems and 3segypt.com.
 * Uses crisp typography and vector Globe icon — zero emoji flags.
 * Directly toggles between Arabic and English with a single tap.
 */
export const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith("ar");

  // Synchronize HTML document direction and language attribute
  useEffect(() => {
    const langCode = isArabic ? "ar" : "en";
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
    document.documentElement.lang = langCode;
  }, [isArabic]);

  const toggleLanguage = () => {
    const nextLang = isArabic ? "en" : "ar";
    i18n.changeLanguage(nextLang);
    window.location.reload();
  };

  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={toggleLanguage}
      aria-label={isArabic ? "Switch to English" : "التبديل إلى العربية"}
      title={isArabic ? "Switch to English" : "التبديل إلى العربية"}
      className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full border border-border/80 bg-secondary/50 hover:bg-secondary/90 text-foreground transition-all duration-200 cursor-pointer shadow-xs min-h-[38px] sm:min-h-[40px]"
    >
      <Globe className="w-4 h-4 text-brand-orange shrink-0" />
      <span className="text-xs sm:text-sm font-bold tracking-wider">
        {isArabic ? "EN" : "عربي"}
      </span>
      <span className="text-[11px] text-muted-foreground hidden xl:inline font-medium">
        {isArabic ? "English" : "العربية"}
      </span>
    </motion.button>
  );
};

export default LanguageSwitcher;
