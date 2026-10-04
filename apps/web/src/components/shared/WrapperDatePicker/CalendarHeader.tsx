'use client';
import { Button } from 'antd';
import type { Dayjs } from 'dayjs';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';

interface CalendarHeaderProps {
  value: Dayjs;
  onChange: (value: Dayjs) => void;
}

/** Month stepper replacing AntD Calendar's year/month selects, which are awkward on touch. */
export function CalendarHeader({ value, onChange }: CalendarHeaderProps) {
  const { t } = useTranslation('common');
  const { monthYear } = useDateFormatter();

  return (
    <div className="flex items-center justify-between px-2 pb-2">
      <Button
        type="text"
        shape="circle"
        icon={<ChevronLeft size={18} />}
        aria-label={t('pickers.prevMonth')}
        onClick={() => onChange(value.subtract(1, 'month'))}
      />
      <span className="text-base font-medium text-brown">{monthYear(value.toDate())}</span>
      <Button
        type="text"
        shape="circle"
        icon={<ChevronRight size={18} />}
        aria-label={t('pickers.nextMonth')}
        onClick={() => onChange(value.add(1, 'month'))}
      />
    </div>
  );
}
