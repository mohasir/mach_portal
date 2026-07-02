import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import esCommon from '../../locales/es/common.json';
import esNotes from '../../locales/es/notes.json';
import enCommon from '../../locales/en/common.json';
import enNotes from '../../locales/en/notes.json';

export const locales = ['es', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'es';

i18n.use(initReactI18next).init({
  resources: {
    es: { common: esCommon, notes: esNotes },
    en: { common: enCommon, notes: enNotes },
  },
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  ns: ['common', 'notes'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
