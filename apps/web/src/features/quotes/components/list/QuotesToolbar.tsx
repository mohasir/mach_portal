'use client';
import { LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { QuotesViewOptions } from '@repo/schemas';
import { FilterToolbar } from '@/components/shared/FilterToolbar';
import { ViewModeToggle } from '@/components/shared/ViewModeToggle';
import { countActiveFilters } from '../../helpers';
import { QuotesFilterChips } from './QuotesFilterChips';
import { QuotesViewSettings } from './QuotesViewSettings';
import type { QuotesViewTab } from '../../quotesView.store';
import type { QuotesPageFilters } from '../../types';

interface QuotesToolbarProps {
  filters: QuotesPageFilters;
  /** Receives only the changed keys, so filters the view hides for now aren't lost. */
  onFiltersChange: (patch: Partial<QuotesPageFilters>) => void;
  searching?: boolean;
  view: QuotesViewTab;
  views: QuotesViewTab[];
  onViewChange: (view: QuotesViewTab) => void;
  viewOptions: QuotesViewOptions;
  /** Results matching the current search/filters; undefined until the view has loaded. */
  total?: number;
}

/** Unsets every filter in the state except the search. */
const clearFiltersPatch = (filters: QuotesPageFilters): Partial<QuotesPageFilters> =>
  Object.fromEntries(
    Object.keys(filters)
      .filter((key) => key !== 'search')
      .map((key) => [key, undefined]),
  );

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
  viewOptions,
  total,
}: QuotesToolbarProps) {
  const { t } = useTranslation('quotes');

  return (
    <FilterToolbar
      search={filters.search}
      onSearch={(value) => onFiltersChange({ search: value || undefined })}
      searching={searching}
      activeFilters={countActiveFilters(filters)}
      onClearFilters={() => onFiltersChange(clearFiltersPatch(filters))}
      chips={
        <QuotesFilterChips
          filters={filters}
          viewOptions={viewOptions}
          view={view}
          onChange={onFiltersChange}
        />
      }
      total={total}
      actions={
        <>
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
          <QuotesViewSettings />
        </>
      }
    />
  );
}
