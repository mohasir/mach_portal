import { NAV_ITEMS } from './constants/items';
import type { NavGroup } from './types';

export const ADMIN_MENU: NavGroup[] = [
  {
    items: [NAV_ITEMS.DASHBOARD, NAV_ITEMS.CALENDAR],
  },
  {
    group: 'nav.groups.commerce',
    items: [NAV_ITEMS.QUOTES, NAV_ITEMS.EVENTS, NAV_ITEMS.CLIENTS, NAV_ITEMS.STAFF],
  },
  {
    group: 'nav.groups.catalog',
    items: [NAV_ITEMS.CATALOG_PRODUCTS, NAV_ITEMS.EVENT_TYPES],
  },
  {
    group: 'nav.groups.users',
    items: [NAV_ITEMS.USERS],
  },
  {
    group: 'nav.groups.others',
    items: [NAV_ITEMS.SETTINGS],
  },
  /* {
    group: 'nav.groups.help',
    items: [NAV_ITEMS.FAQ, NAV_ITEMS.SUPPORT],
  }, */
];
