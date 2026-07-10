import type { Metadata } from 'next';
import { Marcellus, Work_Sans } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AppProviders } from '@/components/providers';
import '@/theme/globals.css';

const marcellus = Marcellus({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-marcellus',
  display: 'swap',
});

const workSans = Work_Sans({
  weight: ['300', '400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-work-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Mach Portal',
  description: 'Mach Portal Application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${marcellus.variable} ${workSans.variable}`}>
      <body>
        <AntdRegistry layer>
          <AppProviders>{children}</AppProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
