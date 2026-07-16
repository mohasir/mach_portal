'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Tooltip } from 'antd';
import { ChevronLeft, ChevronRight, Search, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CalendarViewMode } from './types';

interface CalendarToolbarProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  periodLabel: string;
  onNavigate: (direction: 'prev' | 'next') => void;
  onToday: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}

export function CalendarToolbar({
  viewMode,
  onViewModeChange,
  periodLabel,
  onNavigate,
  onToday,
  search,
  onSearchChange,
}: CalendarToolbarProps) {
  const { t } = useTranslation('events');
  const { t: tAdmin } = useTranslation('admin');
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  const closeSearchIfEmpty = () => {
    if (!search) setSearchOpen(false);
  };

  return (
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onToday}>{t('calendar.today')}</Button>
        <div className="flex items-center">
          <Button
            type="text"
            icon={<ChevronLeft size={16} />}
            onClick={() => onNavigate('prev')}
            aria-label={t('calendar.prev')}
          />
          <Button
            type="text"
            icon={<ChevronRight size={16} />}
            onClick={() => onNavigate('next')}
            aria-label={t('calendar.next')}
          />
        </div>
        <span className="text-lg font-medium">{periodLabel}</span>
      </div>

      <div className="flex items-center gap-2">
        {searchOpen ? (
          <Input
            autoFocus
            allowClear
            prefix={<Search size={14} className="text-muted" />}
            placeholder={t('calendar.searchPlaceholder')}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onBlur={closeSearchIfEmpty}
            className="w-full sm:w-56"
          />
        ) : (
          <Tooltip title={t('calendar.search')}>
            <Button
              type="text"
              icon={<Search size={16} />}
              onClick={() => setSearchOpen(true)}
              aria-label={t('calendar.search')}
            />
          </Tooltip>
        )}
        <Tooltip title={tAdmin('nav.settings')}>
          <Button
            type="text"
            icon={<Settings size={16} />}
            onClick={() => router.push('/admin/settings')}
            aria-label={tAdmin('nav.settings')}
          />
        </Tooltip>
        <Select<CalendarViewMode>
          value={viewMode}
          onChange={onViewModeChange}
          className="w-28"
          options={[
            { value: 'month', label: t('calendar.views.month') },
            { value: 'week', label: t('calendar.views.week') },
            { value: 'year', label: t('calendar.views.year') },
          ]}
        />
      </div>
    </div>
  );
}
