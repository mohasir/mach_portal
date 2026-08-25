import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import 'dayjs/locale/en';
import type { Locale as AppLocale } from '@/lib/i18n/config';

dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

export type DateInput = Date | string | number;

// dayjs' localizedFormat plugin has no abbreviated-month preset (only L/LL/LLL/LLLL) —
// spell out the medium formats per locale, day/month order matching each locale's convention.
const MEDIUM_DATE_FORMAT: Record<AppLocale, string> = {
  es: 'D MMM YYYY',
  en: 'MMM D, YYYY',
};

const MEDIUM_DATE_TIME_FORMAT: Record<AppLocale, string> = {
  es: 'D MMM YYYY, HH:mm',
  en: 'MMM D, YYYY, HH:mm',
};

const toDayjs = (value: DateInput, locale: AppLocale) => dayjs(value).locale(locale);

export const formatDate = (value: DateInput, locale: AppLocale) =>
  toDayjs(value, locale).format(MEDIUM_DATE_FORMAT[locale]);

export const formatDateLong = (value: DateInput, locale: AppLocale) =>
  toDayjs(value, locale).format('LL');

export const formatDateTime = (value: DateInput, locale: AppLocale) =>
  toDayjs(value, locale).format(MEDIUM_DATE_TIME_FORMAT[locale]);

// `eventTime` is stored/displayed elsewhere as a plain "HH:mm" string, not a full date —
// 12h/am-pm is a fixed display choice here (not locale-dependent like the formatters above).
export const formatTime = (value: string) => dayjs(value, 'HH:mm').format('h:mm a');

export const formatDayOfMonth = (value: DateInput, locale: AppLocale) =>
  toDayjs(value, locale).format('D');

export const formatMonthShort = (value: DateInput, locale: AppLocale) =>
  toDayjs(value, locale).format('MMM');

export const formatMonthYear = (value: DateInput, locale: AppLocale) =>
  toDayjs(value, locale).format('MMMM YYYY');

export const formatRelative = (value: DateInput, locale: AppLocale) =>
  toDayjs(value, locale).fromNow();

export const isPastDate = (value?: DateInput | null) =>
  !!value && dayjs(value).isBefore(dayjs(), 'day');

export const isAfter = (value: DateInput, other: DateInput) => dayjs(value).isAfter(dayjs(other));
