'use client';
import { Empty, Skeleton, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { MB } from '@/theme/antd';
import type { DashboardTopProducts } from '../types';

interface TopProductsListProps {
  data: DashboardTopProducts | undefined;
  isLoading: boolean;
  month: number;
  year: number;
}

interface DonutSlice {
  key: string;
  name: string;
  value: number;
  fill: string;
  dotClassName: string;
}

export function TopProductsList({ data, isLoading, month, year }: TopProductsListProps) {
  const { t } = useTranslation('dashboard');
  const { monthYear } = useDateFormatter();
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const [first, second] = items;
  const otherCount = total - (first?.count ?? 0) - (second?.count ?? 0);

  const rawSlices: (DonutSlice | false | undefined)[] = [
    first && {
      key: first.productId,
      name: first.productName,
      value: first.count,
      fill: MB.olive,
      dotClassName: 'bg-olive',
    },
    second && {
      key: second.productId,
      name: second.productName,
      value: second.count,
      fill: MB.salmon,
      dotClassName: 'bg-salmon',
    },
    otherCount > 0 && {
      key: 'other',
      name: t('topProducts.other'),
      value: otherCount,
      fill: MB.taupe,
      dotClassName: 'bg-taupe',
    },
  ];
  const slices = rawSlices.filter((slice): slice is DonutSlice => Boolean(slice));

  return (
    <WrapperCard title={t('topProducts.title')} caption={monthYear(new Date(year, month - 1, 1))}>
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('topProducts.empty')}
          className="my-8"
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="65%"
                  outerRadius="100%"
                  paddingAngle={3}
                  cornerRadius={6}
                  stroke="none"
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${Math.round((Number(value ?? 0) / total) * 100)}%`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {slices.map((slice) => (
              <div key={slice.key} className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${slice.dotClassName}`} />
                <Typography.Text className="text-muted text-sm">{slice.name}</Typography.Text>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Typography.Text className="truncate">{item.productName}</Typography.Text>
                </div>
                <Typography.Text className="text-muted shrink-0 text-sm">
                  {Math.round((item.count / total) * 100)}%
                </Typography.Text>
              </div>
            ))}
          </div>
        </div>
      )}
    </WrapperCard>
  );
}
