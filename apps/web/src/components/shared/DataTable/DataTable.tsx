'use client';
import { Input, Table } from 'antd';
import type { TableProps } from 'antd';
import { useTranslation } from 'react-i18next';
import type { SortDir } from '@repo/schemas';
import { withSortOrder } from './helpers';
import type { DataTableChange } from './types';

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

  return (
    <div className="flex flex-col gap-4">
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
        columns={withSortOrder(columns, sortBy, sortDir)}
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
                showTotal: (n) => t('table.total', { total: n }),
              }
            : { pageSize, hideOnSinglePage: true }
        }
      />
    </div>
  );
}
