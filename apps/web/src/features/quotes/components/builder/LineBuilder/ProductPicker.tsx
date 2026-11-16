'use client';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import type { Product } from '@/features/catalog';
import { blurActiveElementOnTouch } from '@/lib/utils/dom';
import { getPickerState } from '../../../lineHelpers';

interface ProductPickerProps {
  catalog: Product[];
  onAdd: (product: Product) => void;
}

export function ProductPicker({ catalog, onAdd }: ProductPickerProps) {
  const { t } = useTranslation('quotes');
  const vocabulary = useCatalogVocabulary();

  return (
    <div className="sticky top-4 z-10">
      <Select
        showSearch={{ optionFilterProp: 'label' }}
        value={null}
        size="large"
        placeholder={t('builder.lines.addPlaceholder', vocabulary)}
        className="w-full"
        options={catalog.map((p) => ({
          value: p.id,
          label: p.name,
          disabled: !getPickerState(p).selectable,
        }))}
        optionRender={(option) => {
          const product = catalog.find((p) => p.id === option.value);
          const state = product && getPickerState(product);
          return (
            <div className="flex flex-col">
              <span>{option.label}</span>
              {state && !state.selectable && (
                <span className="text-muted text-xs whitespace-normal">{t(state.reasonKey)}</span>
              )}
            </div>
          );
        }}
        onSelect={blurActiveElementOnTouch}
        onChange={(productId: string) => {
          const product = catalog.find((p) => p.id === productId);
          if (product) onAdd(product);
        }}
      />
    </div>
  );
}
