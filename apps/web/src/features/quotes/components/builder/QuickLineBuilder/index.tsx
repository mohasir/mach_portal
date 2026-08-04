'use client';
import { Empty, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { nextLineKey } from '../../../helpers';
import { useQuoteBuilder } from '../../../hooks/useQuoteBuilder';
import { ProductPicker } from '../LineBuilder/ProductPicker';
import { QuickLineCard } from './QuickLineCard';

interface QuickLineBuilderProps {
  catalog: Product[];
  readOnly?: boolean;
}

export function QuickLineBuilder({ catalog, readOnly }: QuickLineBuilderProps) {
  const { t } = useTranslation('quotes');
  const { state, addLine, removeLine, updateLine } = useQuoteBuilder();

  const handleAdd = (product: Product) => {
    const firstTier = product.priceTiers[0];
    if (!firstTier) return;
    addLine({
      key: nextLineKey(),
      productId: product.id,
      numPersons: firstTier.numPersons,
      subtotal: firstTier.price,
      selections: {},
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && <ProductPicker catalog={catalog} onAdd={handleAdd} />}
      <Typography.Title level={4} className="font-heading text-brown m-0!">
        {t('builder.lines.title')}
        {state.lines.length > 0 && ` (${state.lines.length})`}
      </Typography.Title>
      {state.lines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('builder.lines.empty')} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {state.lines.map((line) => {
            const product = catalog.find((p) => p.id === line.productId);
            if (!product) return null;
            return (
              <QuickLineCard
                key={line.key}
                line={line}
                product={product}
                readOnly={readOnly}
                onRemove={() => removeLine(line.key)}
                onChange={(payload) => updateLine(line.key, payload)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
