'use client';
import { usePathname } from 'next/navigation';
import { ADMIN_MENU } from '../config';
import type { NavItem } from '../types';

export type LayoutMode = 'default' | 'bare';

function flattenItems(items: NavItem[]): NavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenItems(item.children) : [])]);
}

const ALL_ITEMS = flattenItems(ADMIN_MENU.flatMap((group) => group.items));

export function useLayoutMode(): LayoutMode {
  const pathname = usePathname() ?? '';

  const match = ALL_ITEMS.filter(
    (item) => item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  ).sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0];

  return match?.layout ?? 'default';
}
