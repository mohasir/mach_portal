'use client';
import dayjs from 'dayjs';
import { Empty, Skeleton } from 'antd';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { DashboardQuotesByMonth } from '../types';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { MB } from '@/theme/antd';

interface QuotesByMonthChartProps {
  year: number;
  data: DashboardQuotesByMonth | undefined;
  isLoading: boolean;
}

export function QuotesByMonthChart({ year, data, isLoading }: QuotesByMonthChartProps) {
  const { t } = useTranslation('dashboard');
  const { monthShort } = useDateFormatter();

  const chartData = (data ?? []).map((row) => ({
    label: monthShort(dayjs(`${year}-${row.month}-01`).toDate()),
    count: row.count,
  }));
  const hasData = chartData.some((row) => row.count > 0);

  return (
    <WrapperCard title={t('chart.title')} caption={year}>
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : !hasData ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('chart.empty')}
          className="my-8"
        />
      ) : (
        <div className="h-64 w-full overflow-x-auto">
          <ResponsiveContainer width="100%" height="100%" minWidth={480}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={MB.border} strokeOpacity={0.15} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} stroke={MB.muted} />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                stroke={MB.muted}
                width={28}
              />
              <Tooltip cursor={{ fill: MB.oliveFaint }} />
              <Bar dataKey="count" fill={MB.olive} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </WrapperCard>
  );
}
