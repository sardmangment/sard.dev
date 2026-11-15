import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enTranslation from "../locales/en/translation.json";
import arTranslation from "../locales/ar/translation.json";

const resources = {
  en: { translation: enTranslation },
  ar: { translation: arTranslation },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "ar"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

// Centralized HTML dir and lang attribute sync across all routes
const updateHtmlAttributes = (lng) => {
  if (typeof document !== 'undefined') {
    const isRtl = (lng || '').startsWith('ar');
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = isRtl ? 'ar' : 'en';
  }
};

i18n.on('languageChanged', (lng) => {
  updateHtmlAttributes(lng);
});

// Initial run
updateHtmlAttributes(i18n.language || 'en');

export default i18n;
