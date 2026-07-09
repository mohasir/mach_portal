import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import type { Locale as AppLocale } from '@/lib/i18n/config';

export type DateInput = Date | string | number;

const DATE_FNS_LOCALES: Record<AppLocale, typeof es> = { es, en: enUS };

const resolveLocale = (locale: AppLocale) => DATE_FNS_LOCALES[locale] ?? es;


const toDate = (value: DateInput): Date =>
  value instanceof Date ? value : typeof value === 'number' ? new Date(value) : parseISO(value);

export const formatDate = (value: DateInput, locale: AppLocale) =>
  format(toDate(value), 'PP', { locale: resolveLocale(locale) });

export const formatDateLong = (value: DateInput, locale: AppLocale) =>
  format(toDate(value), 'PPP', { locale: resolveLocale(locale) });

export const formatDateTime = (value: DateInput, locale: AppLocale) =>
  format(toDate(value), 'PPp', { locale: resolveLocale(locale) });

export const formatRelative = (value: DateInput, locale: AppLocale) =>
  formatDistanceToNow(toDate(value), { locale: resolveLocale(locale), addSuffix: true });
