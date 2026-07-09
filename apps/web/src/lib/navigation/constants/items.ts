import { ACTIONS, RESOURCES } from '@repo/guards';

import type { NavItem } from '../types';

export const DASHBOARD_ITEM: NavItem = {
  label: 'nav.dashboard',
  href: '/admin',
  icon: 'dashboard',
};

export const ORDERS_ITEM: NavItem = {
  label: 'nav.orders',
  href: '/admin/orders',
  icon: 'orders',
};

export const CLIENTS_ITEM: NavItem = {
  label: 'nav.clients',
  href: '/admin/clients',
  icon: 'clients',
};

export const STATISTICS_ITEM: NavItem = {
  label: 'nav.statistics',
  href: '/admin/statistics',
  icon: 'statistics',
};

export const FINANCE_ITEM: NavItem = {
  label: 'nav.finance',
  href: '/admin/finance',
  icon: 'finance',
};

export const NOTES_ITEM: NavItem = {
  label: 'nav.notes',
  href: '/admin/notes',
  icon: 'notes',
  guard: { [RESOURCES.NOTE]: [ACTIONS.READ] },
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
  ORDERS: ORDERS_ITEM,
  CLIENTS: CLIENTS_ITEM,
  STATISTICS: STATISTICS_ITEM,
  FINANCE: FINANCE_ITEM,
  NOTES: NOTES_ITEM,
  FAQ: FAQ_ITEM,
  SUPPORT: SUPPORT_ITEM,
} as const;
