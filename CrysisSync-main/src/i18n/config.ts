import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslation from './locales/en/translation.json';
import hiTranslation from './locales/hi/translation.json';
import bnTranslation from './locales/bn/translation.json';
import esTranslation from './locales/es/translation.json';
import jaTranslation from './locales/ja/translation.json';
import zhCNTranslation from './locales/zh-CN/translation.json';
import zhTWTranslation from './locales/zh-TW/translation.json';

const resources = {
  en: { translation: enTranslation },
  hi: { translation: hiTranslation },
  bn: { translation: bnTranslation },
  es: { translation: esTranslation },
  ja: { translation: jaTranslation },
  'zh-CN': { translation: zhCNTranslation },
  'zh-TW': { translation: zhTWTranslation },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
  });

export default i18n;
