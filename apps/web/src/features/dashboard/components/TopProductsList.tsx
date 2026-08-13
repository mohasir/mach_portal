'use client';
import { Empty, Skeleton, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { WrapperCard } from '@/components/shared/WrapperCard';
import type { DashboardTopProducts } from '../types';

interface TopProductsListProps {
  data: DashboardTopProducts | undefined;
  isLoading: boolean;
}

export function TopProductsList({ data, isLoading }: TopProductsListProps) {
  const { t } = useTranslation('dashboard');
  const items = data ?? [];

  return (
    <WrapperCard title={t('topProducts.title')}>
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('topProducts.empty')}
          className="my-8"
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div key={item.productId} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-olive-faint text-brown flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                  {index + 1}
                </span>
                <Typography.Text className="truncate">{item.productName}</Typography.Text>
              </div>
              <Typography.Text className="text-muted shrink-0 text-sm">
                {item.count}
              </Typography.Text>
            </div>
          ))}
        </div>
      )}
    </WrapperCard>
  );
}
