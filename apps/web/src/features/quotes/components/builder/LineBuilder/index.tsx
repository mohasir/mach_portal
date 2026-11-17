'use client';
import { Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import type { Product } from '@/features/catalog';
import { nextLineKey } from '../../../helpers';
import { useLineConfig } from '../../../hooks/useLineConfig';
import { buildNewLine, withCurrentUnitOnRepricing } from '../../../lineHelpers';
import { useQuoteBuilder } from '../../../hooks/useQuoteBuilder';
import { LineCard } from './LineCard';
import { ProductPicker } from './ProductPicker';

interface LineBuilderProps {
  catalog: Product[];
  readOnly?: boolean;
  canEditPricing: boolean;
}

export function LineBuilder({ catalog, readOnly, canEditPricing }: LineBuilderProps) {
  const { t } = useTranslation('quotes');
  const vocabulary = useCatalogVocabulary();
  const { priceTiersEnabled } = useLineConfig();
  const { state, addLine, removeLine, updateLine, setSelection } = useQuoteBuilder();

  const handleAdd = (product: Product) => {
    const newLine = buildNewLine(product, { priceTiersEnabled });
    if (!newLine) return;
    addLine({ key: nextLineKey(), productId: product.id, ...newLine, selections: {} });
  };

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && <ProductPicker catalog={catalog} onAdd={handleAdd} />}
      {state.lines.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('builder.lines.empty', vocabulary)}
        />
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
              canEditPricing={canEditPricing}
              onRemove={() => removeLine(line.key)}
              onChange={(payload) =>
                updateLine(line.key, withCurrentUnitOnRepricing(line, product, payload))
              }
              onSelectionChange={(groupId, optionIds) => setSelection(line.key, groupId, optionIds)}
            />
          );
        })
      )}
    </div>
  );
}
