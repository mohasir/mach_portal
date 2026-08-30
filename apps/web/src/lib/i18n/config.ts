import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import esCommon from '@/locales/es/common.json';
import esApi from '@/locales/es/api.json';
import esAuth from '@/locales/es/auth.json';
import esAdmin from '@/locales/es/admin.json';
import esDashboard from '@/locales/es/dashboard.json';
import esUsers from '@/locales/es/users.json';
import esClients from '@/locales/es/clients.json';
import esStaff from '@/locales/es/staff.json';
import esCatalog from '@/locales/es/catalog.json';
import esEventTypes from '@/locales/es/eventTypes.json';
import esSettings from '@/locales/es/settings.json';
import esQuotes from '@/locales/es/quotes.json';
import esEvents from '@/locales/es/events.json';
import esPayments from '@/locales/es/payments.json';
import esNotifications from '@/locales/es/notifications.json';
import esSupport from '@/locales/es/support.json';
import enCommon from '@/locales/en/common.json';
import enApi from '@/locales/en/api.json';
import enAuth from '@/locales/en/auth.json';
import enAdmin from '@/locales/en/admin.json';
import enDashboard from '@/locales/en/dashboard.json';
import enUsers from '@/locales/en/users.json';
import enClients from '@/locales/en/clients.json';
import enStaff from '@/locales/en/staff.json';
import enCatalog from '@/locales/en/catalog.json';
import enEventTypes from '@/locales/en/eventTypes.json';
import enSettings from '@/locales/en/settings.json';
import enQuotes from '@/locales/en/quotes.json';
import enEvents from '@/locales/en/events.json';
import enPayments from '@/locales/en/payments.json';
import enNotifications from '@/locales/en/notifications.json';
import enSupport from '@/locales/en/support.json';

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
      dashboard: esDashboard,
      users: esUsers,
      clients: esClients,
      staff: esStaff,
      catalog: esCatalog,
      eventTypes: esEventTypes,
      settings: esSettings,
      quotes: esQuotes,
      events: esEvents,
      payments: esPayments,
      notifications: esNotifications,
      support: esSupport,
    },
    en: {
      common: enCommon,
      api: enApi,
      auth: enAuth,
      admin: enAdmin,
      dashboard: enDashboard,
      users: enUsers,
      clients: enClients,
      staff: enStaff,
      catalog: enCatalog,
      eventTypes: enEventTypes,
      settings: enSettings,
      quotes: enQuotes,
      events: enEvents,
      payments: enPayments,
      notifications: enNotifications,
      support: enSupport,
    },
  },
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  ns: [
    'common',
    'api',
    'auth',
    'admin',
    'dashboard',
    'users',
    'clients',
    'staff',
    'catalog',
    'eventTypes',
    'settings',
    'quotes',
    'events',
    'payments',
    'notifications',
    'support',
  ],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

export default i18n;
