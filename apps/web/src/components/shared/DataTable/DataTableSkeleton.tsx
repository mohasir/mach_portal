'use client';
import { Card, Skeleton, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { withMobileCard } from './helpers';

interface DataTableSkeletonProps<TData> {
  columns: TableColumnsType<TData> | undefined;
  rows: number;
  mobileCard: boolean;
}

export function DataTableSkeleton<TData extends object>({
  columns,
  rows,
  mobileCard,
}: DataTableSkeletonProps<TData>) {
  const cell = () => <Skeleton.Input active size="small" block />;

  const desktop = (columns ?? []).map((col, i) => ({
    ...col,
    key: 'key' in col && col.key != null ? col.key : `sk-col-${i}`,
    render: cell,
  })) as TableColumnsType<TData>;

  const skeletonCard = () => (
    <Card size="small">
      <Skeleton active title={{ width: '55%' }} paragraph={{ rows: 2 }} />
    </Card>
  );

  const cols = mobileCard ? withMobileCard(desktop, skeletonCard) : desktop;
  const data = Array.from({ length: rows }, (_, i) => ({ __sk: i })) as unknown as TData[];

  return (
    <Table<TData>
      columns={cols}
      dataSource={data}
      rowKey="__sk"
      pagination={false}
      scroll={{ x: 'max-content' }}
    />
  );
}
