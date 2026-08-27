'use client';
import { usePathname } from 'next/navigation';

export type ContentBg = 'white' | 'grey' | 'primary/5';

export function useContentBg(): ContentBg {
  return 'primary/5';
}
