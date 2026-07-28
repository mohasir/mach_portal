'use client';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';

interface ProductPickerProps {
  catalog: Product[];
  onAdd: (product: Product) => void;
}

export function ProductPicker({ catalog, onAdd }: ProductPickerProps) {
  const { t } = useTranslation('quotes');

  return (
    <div className="sticky top-4 z-10">
      <Select
        showSearch={{ optionFilterProp: 'label' }}
        value={null}
        size="large"
        placeholder={t('builder.lines.addPlaceholder')}
        className="w-full"
        options={catalog.map((p) => ({ value: p.id, label: p.name }))}
        onChange={(productId: string) => {
          const product = catalog.find((p) => p.id === productId);
          if (product) onAdd(product);
        }}
      />
    </div>
  );
}
