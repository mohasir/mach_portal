import type { Locale as AppLocale } from '@/lib/i18n/config';

const INTL_LOCALES: Record<AppLocale, string> = { es: 'es-US', en: 'en-US' };

export const toMajorUnit = (cents: number) => cents / 100;
export const fromMajorUnit = (amount: number) => Math.round(amount * 100);

export const formatMoney = (cents: number, locale: AppLocale, currency: string) =>
  new Intl.NumberFormat(INTL_LOCALES[locale] ?? 'en-US', {
    style: 'currency',
    currency,
  }).format(toMajorUnit(cents));

export const getCurrencySymbol = (locale: AppLocale, currency: string) =>
  new Intl.NumberFormat(INTL_LOCALES[locale] ?? 'en-US', { style: 'currency', currency })
    .formatToParts(0)
    .find((part) => part.type === 'currency')?.value ?? currency;
