'use client';
import { usePathname } from 'next/navigation';

const HIDE_BOTTOM_NAV_PATTERNS = [
  /^\/admin\/settings/,
  /^\/admin\/quotes\/preview\/[^/]+$/,
  /^\/admin\/events\/[^/]+$/,
];

export function useHideBottomNav(): boolean {
  const pathname = usePathname() ?? '';
  return HIDE_BOTTOM_NAV_PATTERNS.some((pattern) => pattern.test(pathname));
}
