import React, { createContext, useContext, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export type Language = 'ar' | 'en';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (ar: string, en: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const useLanguage = (): LanguageContextType => {
  const { i18n } = useTranslation();
  const currentLang = (i18n.language && i18n.language.startsWith('ar') ? 'ar' : 'en') as Language;
  const isRTL = currentLang === 'ar';

  const setLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
    if (typeof document !== 'undefined') {
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
  };

  const t = (ar: string, en: string) => (currentLang === 'ar' ? ar : en);

  return {
    language: currentLang,
    setLanguage,
    t,
    isRTL,
  };
};

export default LanguageContext;
