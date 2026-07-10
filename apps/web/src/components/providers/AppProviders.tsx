'use client';
import { App, ConfigProvider } from 'antd';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n/config';
import { TRPCReactProvider } from '@/lib/trpc/provider';
import { machBarTheme } from '@/theme/antd';
import { AuthProvider } from './AuthProvider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={machBarTheme}>
      <App>
        <I18nextProvider i18n={i18n}>
          <TRPCReactProvider>
            <AuthProvider>{children}</AuthProvider>
          </TRPCReactProvider>
        </I18nextProvider>
      </App>
    </ConfigProvider>
  );
}
