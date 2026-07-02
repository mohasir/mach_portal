import type { Metadata } from 'next';
import '@repo/ui/globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Mach Portal',
  description: 'Mach Portal Application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
