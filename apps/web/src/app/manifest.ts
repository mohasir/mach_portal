import type { MetadataRoute } from 'next';
import { MB } from '@/theme/antd';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mach Portal',
    short_name: 'Mach Portal',
    description: 'Mach Portal Application',
    start_url: '/',
    display: 'standalone',
    background_color: MB.bg,
    theme_color: MB.olive,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
