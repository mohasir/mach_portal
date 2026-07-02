'use client';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n/config';
import { TRPCReactProvider } from '@/lib/trpc/provider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <TRPCReactProvider>{children}</TRPCReactProvider>
    </I18nextProvider>
  );
}
