import type { PermissionCheck } from '@repo/guards';
import { NAV_ITEMS } from '@/lib/navigation/constants/items';
import type { NavItem } from '@/lib/navigation/types';

const ROUTED_ITEMS: (NavItem & { href: string })[] = Object.values(NAV_ITEMS)
  .filter((item): item is NavItem & { href: string } => !!item.href)
  .sort((a, b) => b.href.length - a.href.length);

const matches = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function resolveRouteAccess(pathname: string): PermissionCheck | null | undefined {
  const item = ROUTED_ITEMS.find((i) => matches(pathname, i.href));
  if (item) return item.guard ?? null;
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return null;
  return undefined;
}
