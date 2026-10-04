'use client';
import { useState } from 'react';
import { Badge, Button } from 'antd';
import { LayoutGrid, List } from 'lucide-react';
import { TbFilter2 } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { SearchInput } from '@/components/shared/SearchInput';
import { ViewModeToggle } from '@/components/shared/ViewModeToggle';
import { countActiveFilters } from '../../helpers';
import { QuotesFilterChips } from './QuotesFilterChips';
import type { QuotesViewTab } from '../../quotesView.store';
import type { QuotesPageFilters } from '../../types';

interface QuotesToolbarProps {
  filters: QuotesPageFilters;
  onFiltersChange: (filters: QuotesPageFilters) => void;
  searching?: boolean;
  view: QuotesViewTab;
  views: QuotesViewTab[];
  onViewChange: (view: QuotesViewTab) => void;
  /** Results matching the current search/filters; undefined until the view has loaded. */
  total?: number;
}

const VIEW_ICONS: Record<QuotesViewTab, typeof List> = {
  table: List,
  pipeline: LayoutGrid,
};

export function QuotesToolbar({
  filters,
  onFiltersChange,
  searching,
  view,
  views,
  onViewChange,
  total,
}: QuotesToolbarProps) {
  const { t } = useTranslation('quotes');
  const { t: tc } = useTranslation('common');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = countActiveFilters(filters);

  const setFilter = (patch: Partial<QuotesPageFilters>) =>
    onFiltersChange({ ...filters, ...patch });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchInput
          value={filters.search}
          loading={searching}
          placeholder={tc('table.search')}
          onSearch={(value) => setFilter({ search: value || undefined })}
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        <Badge count={activeFilters} offset={[-5, 5]}>
          <Button
            icon={<TbFilter2 size={18} />}
            type={filtersOpen ? 'primary' : 'default'}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-label={t('filters.button')}
            aria-expanded={filtersOpen}
            className="px-3"
          >
            <span className="hidden sm:inline">{t('filters.button')}</span>
          </Button>
        </Badge>
      </div>

      {filtersOpen && (
        <div className="py-1">
          <QuotesFilterChips filters={filters} onChange={setFilter} />
        </div>
      )}

      {(filters.search || activeFilters > 0) && (
        <div className="flex items-center justify-end gap-2">
          {filters.search && (
            <Button
              type="link"
              className="px-0 py-1 h-auto"
              onClick={() => setFilter({ search: undefined })}
            >
              {t('filters.clearSearch')}
            </Button>
          )}
          {activeFilters > 0 && (
            <Button
              type="link"
              className="px-0 py-1 h-auto"
              onClick={() => onFiltersChange({ search: filters.search })}
            >
              {t('filters.clear')}
            </Button>
          )}
        </div>
      )}

      <div className="flex min-h-8 items-center justify-between gap-2">
        {total !== undefined && (
          <span className="text-sm text-muted">{tc('table.results', { count: total })}</span>
        )}
        <div className="ml-auto flex items-center gap-4">
          {views.length > 1 && (
            <ViewModeToggle<QuotesViewTab>
              className="ml-auto"
              value={view}
              onChange={onViewChange}
              options={views.map((value) => ({
                value,
                icon: VIEW_ICONS[value],
                label: value === 'table' ? t('title') : t('pipeline.title'),
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
