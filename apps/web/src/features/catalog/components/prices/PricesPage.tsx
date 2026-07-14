'use client';
import { Empty, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { usePricesList } from '../../hooks/usePrices';
import { PriceList } from './PriceList';

export function PricesPage() {
  const { t } = useTranslation('catalog');
  const can = useCan();
  const canEdit = can({ [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] });
  const { data, isLoading } = usePricesList();

  return (
    <div>
      <PageHeader title={t('prices.title')} />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              active
              title={false}
              paragraph={{ rows: 2 }}
              className="border-line rounded-lg border p-3"
            />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <PriceList products={data} canEdit={canEdit} />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('empty')} className="mt-16" />
      )}
    </div>
  );
}
