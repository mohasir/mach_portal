'use client';
import { usePathname } from 'next/navigation';

export type ContentBg = 'white' | 'grey';

const WHITE_BG_ROUTES = ['/admin'];

export function useContentBg(): ContentBg {
  const pathname = usePathname() ?? '';
  return WHITE_BG_ROUTES.includes(pathname) ? 'white' : 'grey';
}
