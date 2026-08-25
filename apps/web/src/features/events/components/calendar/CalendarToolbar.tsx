'use client';
import { Button, Card, Segmented } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CalendarViewMode } from './types';

interface CalendarToolbarProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  periodLabel: string;
  onNavigate: (direction: 'prev' | 'next') => void;
  onToday: () => void;
}

export function CalendarToolbar({
  viewMode,
  onViewModeChange,
  periodLabel,
  onNavigate,
  onToday,
}: CalendarToolbarProps) {
  const { t } = useTranslation('events');

  return (
    <div className="mb-3 flex flex-col gap-3">
      <div className="flex justify-between gap-2">
        <Button type="primary" onClick={onToday}>
          {t('calendar.today')}
        </Button>
        <Segmented<CalendarViewMode>
          value={viewMode}
          onChange={onViewModeChange}
          options={[
            { value: 'month', label: t('calendar.views.month') },
            { value: 'week', label: t('calendar.views.week') },
          ]}
        />
      </div>

      <Card styles={{ body: { padding: '4px 4px' } }}>
        <div className="flex items-center justify-between">
          <Button
            type="text"
            icon={<ChevronLeft size={16} />}
            onClick={() => onNavigate('prev')}
            aria-label={t('calendar.prev')}
          />
          <span className="text-base font-medium">{periodLabel}</span>
          <Button
            type="text"
            icon={<ChevronRight size={16} />}
            onClick={() => onNavigate('next')}
            aria-label={t('calendar.next')}
          />
        </div>
      </Card>
    </div>
  );
}
