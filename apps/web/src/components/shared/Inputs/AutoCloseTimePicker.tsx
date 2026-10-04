'use client';
import { useRef, useState, type ComponentProps } from 'react';
import { TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

type AntTimePickerProps = ComponentProps<typeof TimePicker>;

type TimePickerCloseStrategy = 'complete' | 'select' | 'confirm';

interface AutoCloseTimePickerProps extends AntTimePickerProps {
  closeStrategy?: TimePickerCloseStrategy;
}

type TimeUnit = 'hour' | 'minute' | 'second' | 'meridiem';

const isMeridiemFormat = (format: AntTimePickerProps['format']) =>
  typeof format === 'string' && /a/i.test(format);

function getUnits(format: AntTimePickerProps['format']): TimeUnit[] {
  if (typeof format !== 'string') return ['hour', 'minute'];
  const units: TimeUnit[] = [];
  if (/[Hh]/.test(format)) units.push('hour');
  if (/m/.test(format)) units.push('minute');
  if (/s/.test(format)) units.push('second');
  // A 12h panel has an am/pm column; closing before it's used would lock in the wrong half.
  if (isMeridiemFormat(format)) units.push('meridiem');
  return units.length ? units : ['hour', 'minute'];
}

export function AutoCloseTimePicker({
  closeStrategy = 'complete',
  format,
  needConfirm,
  showNow,
  open: openProp,
  onOpenChange,
  onCalendarChange,
  value,
  ...rest
}: AutoCloseTimePickerProps) {
  const [open, setOpen] = useState(false);
  const touchRef = useRef<{ touched: Set<TimeUnit>; prev: Dayjs }>({
    touched: new Set(),
    prev: dayjs(),
  });

  if (closeStrategy === 'confirm') {
    return (
      <TimePicker
        {...rest}
        value={value}
        format={format}
        needConfirm={needConfirm}
        showNow={showNow}
        open={openProp}
        onOpenChange={onOpenChange}
        onCalendarChange={onCalendarChange}
      />
    );
  }

  const handleOpenChange: NonNullable<AntTimePickerProps['onOpenChange']> = (next) => {
    if (next) {
      const baseline = Array.isArray(value) ? value[0] : value;
      touchRef.current = { touched: new Set(), prev: baseline ?? dayjs() };
    }
    setOpen(next);
    onOpenChange?.(next);
  };

  const handleCalendarChange: NonNullable<AntTimePickerProps['onCalendarChange']> = (
    date,
    dateStr,
    info,
  ) => {
    onCalendarChange?.(date, dateStr, info);
    const next = Array.isArray(date) ? date[0] : date;
    if (!next) return;

    if (closeStrategy === 'select') {
      setOpen(false);
      return;
    }

    const { prev, touched } = touchRef.current;
    if (isMeridiemFormat(format)) {
      // Switching am/pm moves the hour by 12; only a change within the half is an hour pick.
      if (next.hour() % 12 !== prev.hour() % 12) touched.add('hour');
      if (next.hour() < 12 !== prev.hour() < 12) touched.add('meridiem');
    } else if (next.hour() !== prev.hour()) {
      touched.add('hour');
    }
    if (next.minute() !== prev.minute()) touched.add('minute');
    if (next.second() !== prev.second()) touched.add('second');
    touchRef.current.prev = next;

    if (getUnits(format).every((unit) => touched.has(unit))) setOpen(false);
  };

  return (
    <TimePicker
      {...rest}
      value={value}
      format={format}
      needConfirm={false}
      showNow={false}
      open={openProp ?? open}
      onOpenChange={handleOpenChange}
      onCalendarChange={handleCalendarChange}
    />
  );
}
