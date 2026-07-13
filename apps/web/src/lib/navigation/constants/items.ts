import { ACTIONS, RESOURCES } from '@repo/guards';

import type { NavItem } from '../types';

const { READ } = ACTIONS;

export const DASHBOARD_ITEM: NavItem = {
  label: 'nav.dashboard',
  href: '/admin',
  icon: 'dashboard',
  guard: { [RESOURCES.DASHBOARD]: [READ] },
};

export const EVENTS_ITEM: NavItem = {
  label: 'nav.events',
  href: '/admin/events',
  icon: 'events',
  guard: { [RESOURCES.EVENT]: [READ] },
};

export const CLIENTS_ITEM: NavItem = {
  label: 'nav.clients',
  href: '/admin/clients',
  icon: 'clients',
  guard: { [RESOURCES.CLIENT]: [READ] },
};

export const QUOTES_ITEM: NavItem = {
  label: 'nav.quotes',
  href: '/admin/quotes',
  icon: 'quotes',
  guard: { [RESOURCES.QUOTE]: [READ] },
};

export const PIPELINE_ITEM: NavItem = {
  label: 'nav.pipeline',
  href: '/admin/pipeline',
  icon: 'pipeline',
  guard: { [RESOURCES.PIPELINE]: [READ] },
};

export const STAFF_ITEM: NavItem = {
  label: 'nav.staff',
  href: '/admin/staff',
  icon: 'staff',
  guard: { [RESOURCES.STAFF]: [READ] },
};

export const CATALOG_PRODUCTS_ITEM: NavItem = {
  label: 'nav.catalogProducts',
  href: '/admin/catalog',
  icon: 'catalog',
  guard: { [RESOURCES.PRODUCT]: [READ] },
};

export const EVENT_TYPES_ITEM: NavItem = {
  label: 'nav.eventTypes',
  href: '/admin/event-types',
  icon: 'eventTypes',
  guard: { [RESOURCES.EVENT_TYPE]: [READ] },
};

export const USERS_ITEM: NavItem = {
  label: 'nav.users',
  href: '/admin/users',
  icon: 'users',
  guard: { user: ['list'] },
};

export const FAQ_ITEM: NavItem = {
  label: 'nav.faq',
  href: '/admin/faq',
  icon: 'faq',
};

export const SUPPORT_ITEM: NavItem = {
  label: 'nav.support',
  href: '/admin/support',
  icon: 'support',
};

export const NAV_ITEMS = {
  DASHBOARD: DASHBOARD_ITEM,
  EVENTS: EVENTS_ITEM,
  CLIENTS: CLIENTS_ITEM,
  QUOTES: QUOTES_ITEM,
  PIPELINE: PIPELINE_ITEM,
  STAFF: STAFF_ITEM,
  CATALOG_PRODUCTS: CATALOG_PRODUCTS_ITEM,
  EVENT_TYPES: EVENT_TYPES_ITEM,
  USERS: USERS_ITEM,
  FAQ: FAQ_ITEM,
  SUPPORT: SUPPORT_ITEM,
} as const;
