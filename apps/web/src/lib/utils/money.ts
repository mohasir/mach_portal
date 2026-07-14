import type { Locale as AppLocale } from '@/lib/i18n/config';

const INTL_LOCALES: Record<AppLocale, string> = { es: 'es-US', en: 'en-US' };

export const formatMoney = (cents: number, locale: AppLocale, currency: string) =>
  new Intl.NumberFormat(INTL_LOCALES[locale] ?? 'en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
