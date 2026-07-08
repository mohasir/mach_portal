import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import esCommon from '../../locales/es/common.json';
import esNotes from '../../locales/es/notes.json';
import esApi from '../../locales/es/api.json';
import esAuth from '../../locales/es/auth.json';
import enCommon from '../../locales/en/common.json';
import enNotes from '../../locales/en/notes.json';
import enApi from '../../locales/en/api.json';
import enAuth from '../../locales/en/auth.json';

export const locales = ['es', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'es';

i18n.use(initReactI18next).init({
  resources: {
    es: { common: esCommon, notes: esNotes, api: esApi, auth: esAuth },
    en: { common: enCommon, notes: enNotes, api: enApi, auth: enAuth },
  },
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  ns: ['common', 'notes', 'api', 'auth'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
