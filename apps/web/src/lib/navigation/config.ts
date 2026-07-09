import { NAV_ITEMS } from './constants/items';
import type { NavGroup } from './types';

export const ADMIN_MENU: NavGroup[] = [
  {
    items: [
      NAV_ITEMS.DASHBOARD,
      NAV_ITEMS.ORDERS,
      NAV_ITEMS.CLIENTS,
      NAV_ITEMS.STATISTICS,
      NAV_ITEMS.FINANCE,
      NAV_ITEMS.NOTES,
    ],
  },
  {
    group: 'nav.groups.help',
    items: [NAV_ITEMS.FAQ, NAV_ITEMS.SUPPORT],
  },
];
