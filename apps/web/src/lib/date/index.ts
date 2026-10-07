import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import 'dayjs/locale/en';
import type { TimeFormat } from '@repo/schemas';
import type { Locale as AppLocale } from '@/lib/i18n/config';

dayjs.extend(customParseFormat);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

export type DateInput = Date | string | number;

// dayjs' localizedFormat plugin has no abbreviated-month preset (only L/LL/LLL/LLLL) —
// spell out the medium formats per locale, day/month order matching each locale's convention.
const MEDIUM_DATE_FORMAT: Record<AppLocale, string> = {
  es: 'D MMM YYYY',
  en: 'MMM D, YYYY',
};

export const TIME_DISPLAY_FORMAT: Record<TimeFormat, string> = {
  '12h': 'h:mm a',
  '24h': 'HH:mm',
};

const HOUR_DISPLAY_FORMAT: Record<TimeFormat, string> = {
  '12h': 'h a',
  '24h': 'HH:mm',
};

const toDayjs = (value: DateInput, locale: AppLocale) => dayjs(value).locale(locale);

export const formatDate = (value: DateInput, locale: AppLocale) =>
  toDayjs(value, locale).format(MEDIUM_DATE_FORMAT[locale]);

export const formatDateLong = (value: DateInput, locale: AppLocale) =>
  toDayjs(value, locale).format('LL');

export const formatDateTime = (value: DateInput, locale: AppLocale, timeFormat: TimeFormat) =>
  toDayjs(value, locale).format(
    `${MEDIUM_DATE_FORMAT[locale]}, ${TIME_DISPLAY_FORMAT[timeFormat]}`,
  );

// `eventTime` is a free-text column: pickers save "HH:mm", but older rows may hold anything
// ("6pm"), which is shown as typed rather than as "Invalid Date".
export const formatTime = (value: string, timeFormat: TimeFormat) => {
  const parsed = dayjs(value, ['HH:mm', 'H:mm'], true);
  return parsed.isValid() ? parsed.format(TIME_DISPLAY_FORMAT[timeFormat]) : value;
};

/** Hour-of-day label for calendar axes: "2 pm" / "14:00". */
export const formatHour = (hour: number, timeFormat: TimeFormat) =>
  // A fixed date: on a DST switch day, today's 2 am doesn't exist and would shift to 3 am.
  dayjs('2000-01-01').hour(hour).format(HOUR_DISPLAY_FORMAT[timeFormat]);

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

// Shared by every event date/time picker (quote builder, reschedule) so "a valid schedule"
// means the same thing everywhere.
export const disabledPastDate = (current: Dayjs) => current.isBefore(dayjs(), 'day');

export const disabledPastTime = (selectedDate: Dayjs | null | undefined) => () => {
  if (!selectedDate || !selectedDate.isSame(dayjs(), 'day')) return {};
  const now = dayjs();
  return {
    disabledHours: () => Array.from({ length: now.hour() }, (_, h) => h),
    disabledMinutes: (selectedHour: number) =>
      selectedHour === now.hour() ? Array.from({ length: now.minute() }, (_, m) => m) : [],
  };
};
