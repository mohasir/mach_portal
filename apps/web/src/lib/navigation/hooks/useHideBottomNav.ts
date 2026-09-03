'use client';
import { usePathname } from 'next/navigation';
import { ADMIN_MENU, PRIMARY_HREFS } from '../config';

// Every ADMIN_MENU section that isn't a primary bottom tab lives behind the "Opciones"
// grid — its list and detail pages hide the bottom nav. Derived from ADMIN_MENU instead
// of a hand-kept list so a new Opciones section is covered automatically.
const OPCIONES_SECTION_PATTERNS = ADMIN_MENU.flatMap((group) => group.items)
  .map((item) => item.href)
  .filter((href): href is string => !!href && !PRIMARY_HREFS.has(href))
  .map((href) => new RegExp(`^${href}(/|$)`));

const HIDE_BOTTOM_NAV_PATTERNS = [
  /^\/admin\/quotes\/preview\/[^/]+$/,
  ...OPCIONES_SECTION_PATTERNS,
];

export function useHideBottomNav(): boolean {
  const pathname = usePathname() ?? '';
  return HIDE_BOTTOM_NAV_PATTERNS.some((pattern) => pattern.test(pathname));
}
