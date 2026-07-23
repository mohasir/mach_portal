'use client';
import { usePathname } from 'next/navigation';
import { ADMIN_MENU } from '../config';
import { NAV_ITEMS } from '../constants/items';
import type { NavItem } from '../types';

export type LayoutMode = 'default' | 'bare';

function flattenItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenItems(item.children) : [])]);
}

const HIDDEN_LAYOUT_ITEMS: NavItem[] = flattenItems([NAV_ITEMS.QUOTE_BUILDER, NAV_ITEMS.OPTIONS]);

const VISIBLE_ITEMS = flattenItems(ADMIN_MENU.flatMap((group) => group.items));

export function useLayoutMode(): LayoutMode {
  const pathname = usePathname() ?? '';

  // A sidebar destination always wins on an exact match. This lets /admin/quotes (the list,
  // default layout) sit at the same href as the hidden quote-builder item (bare) below, which
  // only ever matches the builder's subpaths (/admin/quotes/new, /admin/quotes/[id], ...).
  const visibleExact = VISIBLE_ITEMS.find((item) => item.href === pathname);
  if (visibleExact) return visibleExact.layout ?? 'default';

  const hiddenMatch = HIDDEN_LAYOUT_ITEMS.filter(
    (item) => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  ).sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];

  return hiddenMatch?.layout ?? 'default';
}
