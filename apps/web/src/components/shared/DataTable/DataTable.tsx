'use client';
import { Grid, Input, Table } from 'antd';
import type { TableProps } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SortDir } from '@repo/schemas';
import { withMobileCard, withSortOrder } from './helpers';
import { DataTableSkeleton } from './DataTableSkeleton';
import type { DataTableChange } from './types';
import { AutoRowCard } from './AutoRowCard';

interface DataTableProps<TData> extends Omit<
  TableProps<TData>,
  'pagination' | 'onChange' | 'title'
> {
  total?: number;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: SortDir;
  onTableChange?: (change: DataTableChange) => void;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
  searchDefaultValue?: string;
  emptyText?: string;
  mobileRenderType?: 'card' | 'list';
  renderCard?: (record: TData, index: number) => ReactNode;
}

export function DataTable<TData extends object>({
  columns,
  total,
  page = 1,
  pageSize = 10,
  sortBy,
  sortDir,
  onTableChange,
  onSearch,
  searchPlaceholder,
  searchDefaultValue,
  emptyText,
  renderCard,
  mobileRenderType = 'list',
  locale,
  loading,
  dataSource,
  ...rest
}: DataTableProps<TData>) {
  const { t } = useTranslation('common');
  const screens = Grid.useBreakpoint();
  const server = total !== undefined;
  const cardMode = mobileRenderType === 'card';

  const mobileCardActive = cardMode && !!screens.xs;

  const handleChange: TableProps<TData>['onChange'] = (pagination, _filters, sorter) => {
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    onTableChange?.({
      page: pagination.current ?? 1,
      pageSize: pagination.pageSize ?? pageSize,
      sortBy: s?.order ? String(s.field) : undefined,
      sortDir: s?.order === 'ascend' ? 'asc' : s?.order === 'descend' ? 'desc' : undefined,
    });
  };

  const card =
    renderCard ??
    ((record: TData, index: number) => (
      <AutoRowCard record={record} index={index} columns={columns} />
    ));

  const columnsWithSortOrder = withSortOrder(columns, sortBy, sortDir);
  const responsiveColumns =
    mobileRenderType === 'card' ? withMobileCard(columnsWithSortOrder, card) : columnsWithSortOrder;

  const firstLoad = !!loading && !dataSource?.length;

  return (
    <div
      className={`mach-datatable flex flex-col gap-4${cardMode ? ' mach-datatable--mobile-card' : ''}`}
    >
      {onSearch && (
        <Input.Search
          allowClear
          disabled={firstLoad}
          defaultValue={searchDefaultValue}
          placeholder={searchPlaceholder}
          onSearch={onSearch}
          className="w-full sm:max-w-xs"
        />
      )}
      {firstLoad ? (
        <DataTableSkeleton<TData>
          columns={columns}
          rows={pageSize}
          mobileCard={mobileRenderType === 'card'}
        />
      ) : (
        <Table<TData>
          {...rest}
          dataSource={dataSource}
          loading={loading}
          columns={responsiveColumns}
          onChange={server ? handleChange : undefined}
          scroll={mobileCardActive ? undefined : { x: 'max-content' }}
          locale={{ emptyText, ...locale }}
          pagination={
            server
              ? {
                  current: page,
                  pageSize,
                  total,
                  showSizeChanger: true,
                  responsive: true,
                  showTotal: (n) => t('table.total', { total: n }),
                }
              : { pageSize, hideOnSinglePage: true, responsive: true }
          }
        />
      )}
    </div>
  );
}
