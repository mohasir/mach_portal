'use client';
import { Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import type { Product } from '@/features/catalog';
import { nextLineKey } from '../../../helpers';
import { useLineConfig } from '../../../hooks/useLineConfig';
import { buildNewLine, lineUnit, withCurrentUnitOnRepricing } from '../../../lineHelpers';
import { useQuoteBuilder } from '../../../hooks/useQuoteBuilder';
import { ProductPicker } from '../LineBuilder/ProductPicker';
import { QuickLineCard } from './QuickLineCard';

interface QuickLineBuilderProps {
  catalog: Product[];
  readOnly?: boolean;
  canEditPricing: boolean;
}

export function QuickLineBuilder({ catalog, readOnly, canEditPricing }: QuickLineBuilderProps) {
  const { t } = useTranslation('quotes');
  const vocabulary = useCatalogVocabulary();
  const { priceTiersEnabled } = useLineConfig();
  const { state, addLine, removeLine, updateLine } = useQuoteBuilder();

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
          {state.lines.map((line) => {
            const product = catalog.find((p) => p.id === line.productId);
            if (!product) return null;
            return readOnly ? (
              <QuickLineCard
                key={line.key}
                mode="readOnly"
                line={{ ...line, unit: lineUnit(line, product) }}
                product={product}
              />
            ) : (
              <QuickLineCard
                key={line.key}
                mode="edit"
                line={line}
                product={product}
                canEditPricing={canEditPricing}
                onRemove={() => removeLine(line.key)}
                onChange={(payload) =>
                  updateLine(line.key, withCurrentUnitOnRepricing(line, product, payload))
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
