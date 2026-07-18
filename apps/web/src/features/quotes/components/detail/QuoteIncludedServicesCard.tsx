'use client';
import { Divider, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { getStationIcon } from '../../helpers';
import type { QuoteDetail } from '../../types';
import { QuoteLineItem } from '../QuoteLineItem';

interface QuoteIncludedServicesCardProps {
  detail: QuoteDetail;
  catalog: Product[];
}

export function QuoteIncludedServicesCard({ detail, catalog }: QuoteIncludedServicesCardProps) {
  const { t } = useTranslation('quotes');

  return (
    <div>
      <Typography.Title level={5} className="font-heading text-brown m-0!">
        {t('detail.includedServices')}
      </Typography.Title>
      <Divider className="mt-3 mb-3" />

      <div className="flex flex-col">
        {detail.lines.map((line) => {
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
              groups={groups}
            />
          );
        })}
      </div>
    </div>
  );
}
