'use client';
import { Card, Input, Table, Typography } from 'antd';
import type { TableColumnsType, TableColumnType, TableProps } from 'antd';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SortDir } from '@repo/schemas';
import { withSortOrder } from './helpers';
import type { DataTableChange } from './types';
import { AutoRowCard } from './AutoRowCard';

const DESKTOP_ONLY = ['sm', 'md', 'lg', 'xl', 'xxl'] as const;
const MOBILE_ONLY = ['xs'] as const;

function withMobileCard<TData>(
  columns: TableColumnsType<TData> | undefined,
  card: (record: TData, index: number) => ReactNode,
): TableColumnsType<TData> {
  const desktop = (columns ?? []).map((col) =>
    'responsive' in col && col.responsive ? col : { ...col, responsive: [...DESKTOP_ONLY] },
  );
  const mobileCard: TableColumnType<TData> = {
    key: '__mobileCard__',
    responsive: [...MOBILE_ONLY],
    render: (_, record, index) => card(record, index),
  };
  return [...desktop, mobileCard];
}

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
  ...rest
}: DataTableProps<TData>) {
  const { t } = useTranslation('common');
  const server = total !== undefined;

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

  return (
    <div className="mach-datatable flex flex-col gap-4">
      {onSearch && (
        <Input.Search
          allowClear
          defaultValue={searchDefaultValue}
          placeholder={searchPlaceholder}
          onSearch={onSearch}
          className="w-full sm:max-w-xs"
        />
      )}
      <Table<TData>
        {...rest}
        columns={responsiveColumns}
        onChange={server ? handleChange : undefined}
        scroll={{ x: 'max-content' }}
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
    </div>
  );
}
