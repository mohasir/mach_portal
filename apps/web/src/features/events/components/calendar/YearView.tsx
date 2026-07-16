'use client';
import { useMemo } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import type { Locale } from '@/lib/i18n/config';

interface YearViewProps {
  year: number;
  locale: Locale;
  onSelectDate: (date: Dayjs) => void;
}

export function YearView({ year, locale, onSelectDate }: YearViewProps) {
  const today = dayjs();

  const weekdayLetters = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        dayjs().locale(locale).day(i).format('dd')[0]!.toUpperCase(),
      ),
    [locale],
  );

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => dayjs(new Date(year, i, 1)).locale(locale)),
    [year, locale],
  );

  return (
    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {months.map((monthStart) => {
        const gridStart = monthStart.startOf('month').startOf('week');
        const cells = Array.from({ length: 42 }, (_, i) => gridStart.add(i, 'day'));

        return (
          <div key={monthStart.format('YYYY-MM')}>
            <button
              type="button"
              onClick={() => onSelectDate(monthStart)}
              className="mb-2 text-sm font-medium capitalize hover:underline"
            >
              {monthStart.format('MMMM')}
            </button>
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {weekdayLetters.map((letter, i) => (
                <span key={i} className="text-xs text-gray-400">
                  {letter}
                </span>
              ))}
              {cells.map((cell) => {
                const inMonth = cell.isSame(monthStart, 'month');
                const isToday = cell.isSame(today, 'day');
                return (
                  <button
                    key={cell.format('YYYY-MM-DD')}
                    type="button"
                    onClick={() => onSelectDate(cell)}
                    className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      inMonth ? '' : 'text-gray-300'
                    } ${isToday ? 'border-primary text-primary border' : ''}`}
                  >
                    {cell.date()}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
