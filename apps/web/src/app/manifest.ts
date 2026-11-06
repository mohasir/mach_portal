import type { MetadataRoute } from 'next';
import { BRAND } from '@/theme/antd';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OraviCloud',
    short_name: 'OraviCloud',
    description: 'OraviCloud',
    start_url: '/',
    display: 'standalone',
    background_color: BRAND.bg,
    theme_color: BRAND.navy,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
