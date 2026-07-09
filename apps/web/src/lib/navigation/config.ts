import { NAV_ITEMS } from './constants/items';
import type { NavGroup } from './types';

export const ADMIN_MENU: NavGroup[] = [
  {
    items: [
      NAV_ITEMS.DASHBOARD,
      NAV_ITEMS.EVENTS,
      NAV_ITEMS.CLIENTS,
      NAV_ITEMS.QUOTES,
      NAV_ITEMS.PIPELINE,
    ],
  },
  {
    group: 'nav.groups.users',
    items: [NAV_ITEMS.USERS],
  },
  {
    group: 'nav.groups.help',
    items: [NAV_ITEMS.FAQ, NAV_ITEMS.SUPPORT],
  },
];
