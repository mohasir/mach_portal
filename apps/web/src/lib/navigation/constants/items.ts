import { ACTIONS, RESOURCES } from '@repo/guards';

import type { NavItem } from '../types';

const { READ, VIEW } = ACTIONS;

export const DASHBOARD_ITEM: NavItem = {
  label: 'nav.home',
  href: '/admin',
  icon: 'home',
  guard: { [RESOURCES.DASHBOARD]: [READ] },
  alwaysVisible: true,
};

export const CALENDAR_ITEM: NavItem = {
  feature: 'events',
  label: 'nav.calendarTab',
  href: '/admin/calendar',
  icon: 'calendar',
  guard: { [RESOURCES.EVENT]: [READ] },
};

export const EVENTS_ITEM: NavItem = {
  feature: 'events',
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

export const PAYMENTS_ITEM: NavItem = {
  feature: 'events',
  label: 'nav.payments',
  href: '/admin/payments',
  icon: 'payments',
  guard: { [RESOURCES.PAYMENT]: [READ] },
};

export const QUOTES_ITEM: NavItem = {
  feature: 'quotes',
  label: 'nav.quotes',
  href: '/admin/quotes',
  icon: 'quotes',
  guard: { [RESOURCES.QUOTE]: [READ] },
};

export const QUOTE_BUILDER_ITEM: NavItem = {
  feature: 'quotes',
  label: 'nav.quotes',
  href: '/admin/quotes',
  layout: 'bare',
};

export const PIPELINE_ITEM: NavItem = {
  feature: 'quotes',
  label: 'nav.pipeline',
  href: '/admin/pipeline',
  icon: 'pipeline',
  guard: { [RESOURCES.PIPELINE]: [READ] },
};

export const STAFF_ITEM: NavItem = {
  feature: 'events',
  label: 'nav.staff',
  href: '/admin/staff',
  icon: 'staff',
  guard: { [RESOURCES.STAFF]: [READ] },
};

export const CATALOG_PRODUCTS_ITEM: NavItem = {
  label: 'nav.catalogProducts',
  href: '/admin/products',
  icon: 'catalog',
  guard: { [RESOURCES.PRODUCT]: [READ] },
  layout: 'bare',
};

export const UNITS_OF_MEASURE_ITEM: NavItem = {
  label: 'nav.unitsOfMeasure',
  href: '/admin/units-of-measure',
  icon: 'unitsOfMeasure',
  guard: { [RESOURCES.UNIT_OF_MEASURE]: [READ] },
};

export const PRODUCT_CATEGORIES_ITEM: NavItem = {
  label: 'nav.productCategories',
  href: '/admin/product-categories',
  icon: 'productCategories',
  guard: { [RESOURCES.PRODUCT_CATEGORY]: [READ] },
};

export const EVENT_TYPES_ITEM: NavItem = {
  feature: 'events',
  label: 'nav.eventTypes',
  href: '/admin/event-types',
  icon: 'eventTypes',
  guard: { [RESOURCES.EVENT_TYPE]: [READ] },
};

export const RESCHEDULE_REASONS_ITEM: NavItem = {
  feature: 'events',
  label: 'nav.rescheduleReasons',
  href: '/admin/reschedule-reasons',
  icon: 'rescheduleReasons',
  guard: { [RESOURCES.RESCHEDULE_REASON]: [VIEW] },
};

export const SETTINGS_ITEM: NavItem = {
  label: 'nav.settings',
  href: '/admin/settings',
  icon: 'settings',
  layout: 'bare',
};

export const OPTIONS_ITEM: NavItem = {
  label: 'nav.options',
  href: '/admin/options',
  icon: 'more',
  layout: 'bare',
};

export const USERS_ITEM: NavItem = {
  label: 'nav.users',
  href: '/admin/users',
  icon: 'users',
  guard: { user: ['list'] },
};

export const ROLES_ITEM: NavItem = {
  label: 'nav.roles',
  href: '/admin/roles',
  icon: 'roles',
  guard: { [RESOURCES.ROLE]: [READ] },
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
  CALENDAR: CALENDAR_ITEM,
  EVENTS: EVENTS_ITEM,
  CLIENTS: CLIENTS_ITEM,
  PAYMENTS: PAYMENTS_ITEM,
  QUOTES: QUOTES_ITEM,
  QUOTE_BUILDER: QUOTE_BUILDER_ITEM,
  PIPELINE: PIPELINE_ITEM,
  STAFF: STAFF_ITEM,
  CATALOG_PRODUCTS: CATALOG_PRODUCTS_ITEM,
  UNITS_OF_MEASURE: UNITS_OF_MEASURE_ITEM,
  PRODUCT_CATEGORIES: PRODUCT_CATEGORIES_ITEM,
  EVENT_TYPES: EVENT_TYPES_ITEM,
  RESCHEDULE_REASONS: RESCHEDULE_REASONS_ITEM,
  SETTINGS: SETTINGS_ITEM,
  OPTIONS: OPTIONS_ITEM,
  USERS: USERS_ITEM,
  ROLES: ROLES_ITEM,
  FAQ: FAQ_ITEM,
  SUPPORT: SUPPORT_ITEM,
} as const;
