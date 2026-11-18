import { ACTIONS, RESOURCES, type FeatureKey, type PermissionCheck } from '@repo/guards';
import { DENIED_ROUTE, WELCOME_ROUTE } from './navigation';
import { NAV_ITEMS } from '@/lib/navigation/constants/items';
import type { NavItem } from '@/lib/navigation/types';

const ROUTED_ITEMS: (NavItem & { href: string })[] = Object.values(NAV_ITEMS)
  .filter((item): item is NavItem & { href: string } => !!item.href)
  .sort((a, b) => b.href.length - a.href.length);

const matches = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

// Routes with a dynamic segment that need a stricter permission than the nav item whose
// prefix they share (e.g. /admin/events would otherwise grant EVENT:READ).
const ROUTE_PATTERNS: { pattern: RegExp; guard?: PermissionCheck; feature?: FeatureKey }[] = [
  {
    pattern: /^\/admin\/events\/[^/]+\/reschedule\/?$/,
    guard: { [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] },
    feature: 'events',
  },
  { pattern: /^\/admin\/products\/new\/?$/, guard: { [RESOURCES.PRODUCT]: [ACTIONS.CREATE] } },
  {
    pattern: /^\/admin\/products\/[^/]+\/edit\/?$/,
    guard: { [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] },
  },
  // No nav item: the notifications center is reached from the topbar bell.
  { pattern: /^\/admin\/notifications(\/.*)?$/, feature: 'notifications' },
];

// The landing screens a denial redirects to; guarding them would loop the redirect.
const OPEN_ROUTES = [WELCOME_ROUTE, DENIED_ROUTE];

export function resolveRouteAccess(pathname: string): PermissionCheck | null | undefined {
  if (OPEN_ROUTES.includes(pathname)) return null;
  const routePattern = ROUTE_PATTERNS.find(({ pattern }) => pattern.test(pathname));
  if (routePattern?.guard) return routePattern.guard;
  const item = ROUTED_ITEMS.find((i) => matches(pathname, i.href));
  if (item) return item.guard ?? null;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return null;
  return undefined;
}

/** The feature (module) a route belongs to, or undefined for core routes. */
export function resolveRouteFeature(pathname: string): FeatureKey | undefined {
  const routePattern = ROUTE_PATTERNS.find(({ pattern }) => pattern.test(pathname));
  if (routePattern?.feature) return routePattern.feature;
  return ROUTED_ITEMS.find((i) => matches(pathname, i.href))?.feature;
}
