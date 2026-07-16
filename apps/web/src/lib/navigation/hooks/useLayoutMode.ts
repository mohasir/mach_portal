'use client';
import { usePathname } from 'next/navigation';
import { ADMIN_MENU } from '../config';
import { NAV_ITEMS } from '../constants/items';
import type { NavItem } from '../types';

export type LayoutMode = 'default' | 'bare';

function flattenItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenItems(item.children) : [])]);
}

// Routes with a layout override that aren't sidebar destinations (e.g. the quote builder, only
// reachable from the Events page) — kept out of ADMIN_MENU so they don't render in the sidebar.
const HIDDEN_LAYOUT_ITEMS: NavItem[] = [NAV_ITEMS.QUOTES];

const ALL_ITEMS = flattenItems([
  ...ADMIN_MENU.flatMap((group) => group.items),
  ...HIDDEN_LAYOUT_ITEMS,
]);

export function useLayoutMode(): LayoutMode {
  const pathname = usePathname() ?? '';

  const match = ALL_ITEMS.filter(
    (item) => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  ).sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];

  return match?.layout ?? 'default';
}
