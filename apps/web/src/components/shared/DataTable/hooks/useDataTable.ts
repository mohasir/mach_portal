import { useState } from 'react';
import type { SortDir } from '@repo/schemas';
import type { DataTableChange, UseDataTableOptions } from '../types';

export function useDataTable<TSort extends string>({
  defaultSortBy,
  defaultSortDir = 'desc',
  defaultPageSize = 10,
  externalFilters,
}: UseDataTableOptions<TSort>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<TSort>(defaultSortBy);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);
  const filtersKey = JSON.stringify(externalFilters ?? null);
  const [appliedFiltersKey, setAppliedFiltersKey] = useState(filtersKey);

  // Adjusting state during render (not in an effect) so the stale page never hits the API.
  if (filtersKey !== appliedFiltersKey) {
    setAppliedFiltersKey(filtersKey);
    setPage(1);
  }

  const onSearch = (value: string) => {
    setSearch(value.trim());
    setPage(1);
  };

  const onTableChange = (next: DataTableChange) => {
    const nextSortBy = (next.sortBy as TSort | undefined) ?? defaultSortBy;
    const nextSortDir = next.sortDir ?? defaultSortDir;
    // A sort or page-size change invalidates the current offset, so go back to page 1.
    const reset = nextSortBy !== sortBy || nextSortDir !== sortDir || next.pageSize !== pageSize;
    setSortBy(nextSortBy);
    setSortDir(nextSortDir);
    setPageSize(next.pageSize);
    setPage(reset ? 1 : next.page);
  };

  const query = { page, pageSize, search: search || undefined, sortBy, sortDir };

  return {
    query,
    tableProps: { page, pageSize, sortBy, sortDir, onSearch, onTableChange },
  };
}
