'use client';
import { Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { useConfig } from '@/features/settings';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import type { QuoteDetail } from '../../types';
import { QuickLineCard } from '../builder/QuickLineBuilder/QuickLineCard';

type LineRow = QuoteDetail['lines'][number] & { product: Product };

interface QuoteLinesCardProps {
  detail: QuoteDetail;
  catalog: Product[];
  variant?: 'card' | 'plain';
}

export function QuoteLinesCard({ detail, catalog, variant }: QuoteLinesCardProps) {
  const { t } = useTranslation('quotes');
  const { date } = useDateFormatter();
  const { data: config } = useConfig();

  const lineRows = detail.lines
    .map((line) => {
      const product = catalog.find((p) => p.id === line.productId);
      return product ? { ...line, product } : null;
    })
    .filter((row): row is LineRow => row !== null);

  const title = `${t('builder.lines.title')}${lineRows.length > 0 ? ` (${lineRows.length})` : ''}`;

  return (
    <WrapperCard variant={variant} title={title}>
      <div className="flex flex-col gap-3">
        {detail.validUntil && (
          <WrapperAlert
            type="info"
            showIcon
            title={t('detail.validUntil', {
              date: date(detail.validUntil),
              count: config?.appSettings.quoteValidityMonths ?? 0,
            })}
          />
        )}
        {lineRows.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('builder.lines.empty')} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {lineRows.map((row) => (
              <QuickLineCard
                key={row.id}
                mode="readOnly"
                line={{ numPersons: row.numPersons, subtotal: row.subtotal }}
                product={row.product}
              />
            ))}
          </div>
        )}
      </div>
    </WrapperCard>
  );
}
