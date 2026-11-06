import type { Metadata, Viewport } from 'next';
import { Fustat } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AppProviders } from '@/components/providers';
import { BRAND } from '@/theme/antd';
import '@/theme/globals.css';

const fustat = Fustat({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-fustat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OraviCloud',
  description: 'OraviCloud',
  icons: {
    icon: [{ url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OraviCloud',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: BRAND.navy,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={fustat.variable}>
      <body>
        <AntdRegistry layer>
          <AppProviders>{children}</AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
