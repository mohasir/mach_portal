'use client';
import { Card, Divider, Empty, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import type { EventDetail } from '../../types';

interface EventCompositionProps {
  lines: EventDetail['lines'];
  catalog: Product[];
}

export function EventComposition({ lines, catalog }: EventCompositionProps) {
  const { t } = useTranslation('events');
  const { money } = useMoneyFormatter();

  return (
    <Card size="small" title={t('detail.composition.title')}>
      {lines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="flex flex-col">
          {lines.map((line, index) => {
            const product = catalog.find((p) => p.id === line.productId);
            if (!product) return null;

            const includedOptions = product.optionGroups
              .filter((g) => g.selectionType === 'included')
              .flatMap((g) => g.options);
            const selectedOptions = line.selections.flatMap((selection) => {
              const group = product.optionGroups.find((g) => g.id === selection.optionGroupId);
              return selection.optionIds
                .map((optionId) => group?.options.find((o) => o.id === optionId))
                .filter((o) => o !== undefined);
            });

            return (
              <div key={line.id}>
                {index > 0 && <Divider className="my-2" />}
                <div className="flex justify-between">
                  <span className="font-medium">{product.name}</span>
                  <span className="font-medium">{money(line.subtotal)}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {t('detail.composition.numPersons', { count: line.numPersons })}
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {selectedOptions.map((option) => (
                    <Tag key={option.id}>{option.name}</Tag>
                  ))}
                  {includedOptions.map((option) => (
                    <Tag key={option.id} color="default">
                      {option.name}
                    </Tag>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
