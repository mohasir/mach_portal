'use client';
import { Card, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { getStationIcon, QuoteLineItem } from '@/features/quotes';
import type { EventDetail } from '../../types';

interface EventCompositionProps {
  lines: EventDetail['lines'];
  catalog: Product[];
}

export function EventComposition({ lines, catalog }: EventCompositionProps) {
  const { t } = useTranslation('events');

  return (
    <Card size="small" title={t('detail.composition.title')}>
      {lines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="flex flex-col">
          {lines.map((line) => {
            const product = catalog.find((p) => p.id === line.productId);
            if (!product) return null;
            const groups = product.optionGroups
              .map((group) => {
                const isIncluded = group.selectionType === 'included';
                const selection = line.selections.find((s) => s.optionGroupId === group.id);
                const options = isIncluded
                  ? group.options
                  : group.options.filter((o) => selection?.optionIds.includes(o.id));
                return {
                  key: group.id,
                  label: group.label,
                  isIncluded,
                  optionNames: options.map((option) => option.name),
                };
              })
              .filter((group) => group.optionNames.length > 0);

            return (
              <QuoteLineItem
                key={line.id}
                icon={getStationIcon(product.name)}
                name={product.name}
                numPersons={line.numPersons}
                total={line.subtotal}
                groups={groups}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}
