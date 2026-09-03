import { NAV_ITEMS } from './constants/items';
import type { NavGroup } from './types';

export const ADMIN_MENU: NavGroup[] = [
  {
    items: [NAV_ITEMS.DASHBOARD, NAV_ITEMS.CALENDAR],
  },
  {
    group: 'nav.groups.commerce',
    items: [
      NAV_ITEMS.QUOTES,
      NAV_ITEMS.EVENTS,
      NAV_ITEMS.PAYMENTS,
      NAV_ITEMS.CLIENTS,
      NAV_ITEMS.STAFF,
    ],
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

export const NAV_BOTTOM_MENU = {
  leftItems: [NAV_ITEMS.DASHBOARD, NAV_ITEMS.CALENDAR],
  rightItems: [NAV_ITEMS.QUOTES, NAV_ITEMS.OPTIONS],
};

// The 4 destinations that live directly on the bottom tab bar — every other ADMIN_MENU
// section is reached through the "Opciones" grid instead, so its pages hide the bottom
// nav (see useHideBottomNav). Derived from NAV_BOTTOM_MENU so a new primary tab can't
// silently drift out of sync with that hiding rule.
export const PRIMARY_HREFS = new Set(
  [...NAV_BOTTOM_MENU.leftItems, ...NAV_BOTTOM_MENU.rightItems]
    .map((item) => item.href)
    .filter((href): href is string => !!href),
);
