'use client';
import { useState } from 'react';
import { Calendar } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { CalendarHeader } from '@/components/shared/WrapperDatePicker';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { pickDay } from './helpers';
import type { DateRangeCalendarProps } from './types';

type RangeEnd = 'from' | 'to';

/**
 * Range picker built on AntD's Calendar: two fields show the start and end, and the single calendar
 * below sets whichever field is active. Picking the start moves on to the end automatically.
 */
export function DateRangeCalendar({ value, onChange, disabledDate }: DateRangeCalendarProps) {
  const { t } = useTranslation('common');
  const { date } = useDateFormatter();
  const [editing, setEditing] = useState<RangeEnd>(value.from && !value.to ? 'to' : 'from');
  // Month on display, kept apart from the picked dates so paging months doesn't pick anything.
  const [panel, setPanel] = useState<Dayjs>(() => value.from ?? dayjs());

  const editField = (end: RangeEnd) => {
    setEditing(end);
    const day = value[end];
    if (day) setPanel(day);
  };

  const pick = (day: Dayjs) => {
    onChange(pickDay(value, day, editing));
    setPanel(day);
    if (editing === 'from') setEditing('to');
  };

  // Same look as AntD's RangePicker: the ends are the cell's own small square (the child is AntD's
  // cell inner) filled solid and squared off on the side facing the range, and a light band runs
  // between them, reaching only the middle of the end cells.
  const rangeClass = (day: Dayjs) => {
    const { from, to } = value;
    if (!day.isSame(panel, 'month')) return '';
    const isFrom = !!from && day.isSame(from, 'day');
    const isTo = !!to && day.isSame(to, 'day');
    const solid = '*:bg-primary *:text-white';
    if (isFrom && isTo) return solid;
    if (isFrom) {
      return to
        ? `${solid} *:rounded-r-none bg-linear-to-r from-transparent from-50% to-primary/15 to-50%`
        : solid;
    }
    if (isTo) {
      return from
        ? `${solid} *:rounded-l-none bg-linear-to-l from-transparent from-50% to-primary/15 to-50%`
        : solid;
    }
    return from && to && day.isAfter(from, 'day') && day.isBefore(to, 'day') ? 'bg-primary/15' : '';
  };

  const field = (end: RangeEnd) => {
    const day = value[end];
    return (
      <button
        type="button"
        onClick={() => editField(end)}
        aria-pressed={editing === end}
        className={`h-10 min-w-0 flex-1 cursor-pointer truncate rounded-lg border bg-surface px-3 text-left text-sm ${
          editing === end ? 'border-primary' : 'border-line'
        } ${day ? 'text-foreground' : 'text-muted'}`}
      >
        {day ? date(day.toDate()) : t(`filters.${end}`)}
      </button>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 px-4 pb-3">
        {field('from')}
        <span className="text-muted">—</span>
        {field('to')}
      </div>
      <Calendar
        className="mach-picked-calendar"
        fullscreen={false}
        value={panel}
        onPanelChange={setPanel}
        onSelect={(day, { source }) => {
          if (source === 'date') pick(day);
        }}
        // The end can't come before the start; the start is free (a later one clears the end).
        disabledDate={(day) =>
          !!disabledDate?.(day) ||
          (editing === 'to' && !!value.from && day.isBefore(value.from, 'day'))
        }
        fullCellRender={(day, info) => <div className={rangeClass(day)}>{info.originNode}</div>}
        headerRender={({ value: month, onChange: setMonth }) => (
          <CalendarHeader value={month} onChange={setMonth} />
        )}
      />
    </div>
  );
}
