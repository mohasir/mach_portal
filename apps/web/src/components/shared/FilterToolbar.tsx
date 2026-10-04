'use client';
import { useState, type ReactNode } from 'react';
import { Badge, Button } from 'antd';
import { TbFilter2 } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { SearchInput } from '@/components/shared/SearchInput';

interface FilterToolbarProps {
  /** The search currently applied. */
  search?: string;
  /** Fires with the trimmed text, or '' when the search is cleared. */
  onSearch: (value: string) => void;
  /** Swaps the search icon for a spinner while results for a new query load. */
  searching?: boolean;
  /** Filter criteria in use, shown as the filter button's badge. */
  activeFilters: number;
  onClearFilters: () => void;
  /** The filter chip row, shown while the filter button is toggled on. */
  chips: ReactNode;
  /** Results matching the current search/filters; undefined until the list has loaded. */
  total?: number;
  /** Right side of the results row (e.g. view toggles). */
  actions?: ReactNode;
}

/** List header: search, a filter button that reveals the chips, clear links and the result count. */
export function FilterToolbar({
  search,
  onSearch,
  searching,
  activeFilters,
  onClearFilters,
  chips,
  total,
  actions,
}: FilterToolbarProps) {
  const { t } = useTranslation('common');
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <SearchInput
          value={search}
          loading={searching}
          placeholder={t('table.search')}
          onSearch={onSearch}
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

      {filtersOpen && <div className="py-1">{chips}</div>}

      {(search || activeFilters > 0) && (
        <div className="flex items-center justify-end gap-2">
          {search && (
            <Button type="link" className="h-auto px-0 py-1" onClick={() => onSearch('')}>
              {t('table.clearSearch')}
            </Button>
          )}
          {activeFilters > 0 && (
            <Button type="link" className="h-auto px-0 py-1" onClick={onClearFilters}>
              {t('table.clearFilters')}
            </Button>
          )}
        </div>
      )}

      <div className="flex min-h-8 items-center justify-between gap-2">
        {total !== undefined && (
          <span className="text-sm text-muted">{t('table.results', { count: total })}</span>
        )}
        {actions && <div className="ml-auto flex items-center gap-4">{actions}</div>}
      </div>
    </div>
  );
}
