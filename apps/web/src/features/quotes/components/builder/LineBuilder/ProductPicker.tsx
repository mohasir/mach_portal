'use client';
import { Select } from 'antd';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';

interface ProductPickerProps {
  catalog: Product[];
  onAdd: (product: Product) => void;
}

export function ProductPicker({ catalog, onAdd }: ProductPickerProps) {
  const { t } = useTranslation('quotes');

  return (
    // Sticky so it's reachable while scrolling a long list of added lines, not just at the top.
    // Opaque bg (not a tinted/transparent one) so it fully covers whatever scrolls underneath.
    <div className="border-primary/40 bg-surface sticky top-4 z-10 rounded-lg border-2 border-dashed p-2 shadow-md">
      <Select
        showSearch={{ optionFilterProp: 'label' }}
        value={null}
        size="large"
        variant="borderless"
        prefix={<Plus size={18} className="text-primary shrink-0" />}
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
