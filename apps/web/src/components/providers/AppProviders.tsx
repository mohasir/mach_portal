'use client';
import { App, ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import enUS from 'antd/locale/en_US';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { useLocaleStore } from '@/lib/stores/locale.store';
import { TRPCReactProvider } from '@/lib/trpc/provider';
import { machBarTheme } from '@/theme/antd';
import { AuthProvider } from './AuthProvider';
import { SettingsProvider } from './SettingsProvider';

const ANTD_LOCALES: Record<Locale, typeof esES> = { es: esES, en: enUS };

export function AppProviders({ children }: { children: React.ReactNode }) {
  const locale = useLocaleStore((s) => s.locale) as Locale;

  return (
    <ConfigProvider theme={machBarTheme} locale={ANTD_LOCALES[locale] ?? esES}>
      <App>
        <I18nextProvider i18n={i18n}>
          <TRPCReactProvider>
            <SettingsProvider>
              <AuthProvider>{children}</AuthProvider>
            </SettingsProvider>
          </TRPCReactProvider>
        </I18nextProvider>
      </App>
    </ConfigProvider>
  );
}
