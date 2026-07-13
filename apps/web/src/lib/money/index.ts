import type { Locale as AppLocale } from '@/lib/i18n/config';

const CURRENCY = 'USD';

const INTL_LOCALES: Record<AppLocale, string> = { es: 'es-US', en: 'en-US' };

export const formatMoney = (cents: number, locale: AppLocale) =>
  new Intl.NumberFormat(INTL_LOCALES[locale] ?? 'en-US', {
    style: 'currency',
    currency: CURRENCY,
  }).format(cents / 100);
