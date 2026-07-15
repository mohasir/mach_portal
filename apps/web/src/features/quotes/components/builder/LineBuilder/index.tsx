'use client';
import { Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { nextLineKey } from '../../../helpers';
import { useQuoteBuilder } from '../../../hooks/useQuoteBuilder';
import { LineCard } from './LineCard';
import { ProductPicker } from './ProductPicker';

interface LineBuilderProps {
  catalog: Product[];
  readOnly?: boolean;
}

export function LineBuilder({ catalog, readOnly }: LineBuilderProps) {
  const { t } = useTranslation('quotes');
  const { state, addLine, removeLine, updateLine, setSelection } = useQuoteBuilder();

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
      {state.lines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('builder.lines.empty')} />
      ) : (
        state.lines.map((line) => {
          const product = catalog.find((p) => p.id === line.productId);
          if (!product) return null;
          return (
            <LineCard
              key={line.key}
              line={line}
              product={product}
              readOnly={readOnly}
              onRemove={() => removeLine(line.key)}
              onChange={(payload) => updateLine(line.key, payload)}
              onSelectionChange={(groupId, optionIds) => setSelection(line.key, groupId, optionIds)}
            />
          );
        })
      )}
      {!readOnly && <ProductPicker catalog={catalog} onAdd={handleAdd} />}
    </div>
  );
}
