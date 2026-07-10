import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import esCommon from '../../locales/es/common.json';
import esApi from '../../locales/es/api.json';
import esAuth from '../../locales/es/auth.json';
import esAdmin from '../../locales/es/admin.json';
import esUsers from '../../locales/es/users.json';
import enCommon from '../../locales/en/common.json';
import enApi from '../../locales/en/api.json';
import enAuth from '../../locales/en/auth.json';
import enAdmin from '../../locales/en/admin.json';
import enUsers from '../../locales/en/users.json';

export const locales = ['es', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'es';

i18n.use(initReactI18next).init({
  resources: {
    es: {
      common: esCommon,
      api: esApi,
      auth: esAuth,
      admin: esAdmin,
      users: esUsers
    },
    en: {
      common: enCommon,
      api: enApi,
      auth: enAuth,
      admin: enAdmin,
      users: enUsers
    },
  },
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  ns: ['common', 'api', 'auth', 'admin', 'users'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
