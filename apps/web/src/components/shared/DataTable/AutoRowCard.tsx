import { Card, TableColumnsType, TableColumnType, Typography } from 'antd';
import { ReactNode } from 'react';

export function AutoRowCard<TData extends object>({
  record,
  index,
  columns,
}: {
  record: TData;
  index: number;
  columns: TableColumnsType<TData> | undefined;
}) {
  const cols = (columns ?? []) as TableColumnType<TData>[];
  const fields = cols.filter((c) => c.title);
  const actions = cols.filter((c) => !c.title && c.render);

  const cell = (col: TableColumnType<TData>): ReactNode => {
    const value =
      col.dataIndex != null
        ? (record as Record<string, unknown>)[col.dataIndex as string]
        : undefined;
    return col.render ? (col.render(value, record, index) as ReactNode) : (value as ReactNode);
  };

  return (
    <Card size="small">
      {actions.length > 0 && (
        <div className="mb-2 flex justify-end">
          {actions.map((col, i) => (
            <span key={i}>{cell(col)}</span>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {fields.map((col, i) => (
          <div key={String(col.key ?? i)} className="flex items-start justify-between gap-3">
            <Typography.Text type="secondary" className="text-xs">
              {col.title as ReactNode}
            </Typography.Text>
            <div className="min-w-0 wrap-break-word text-right">{cell(col)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
