'use client';
import { useState } from 'react';
import { Empty, Select, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import { useCategoryOptions } from '@/features/product-categories';
import { categoryFilterOptions, filterByCategory, NO_CATEGORY } from '../helpers';
import { useCatalog } from '../hooks/useCatalog';
import { ProductList } from './ProductList';

export function CatalogPage() {
  const { t } = useTranslation('catalog');
  const vocabulary = useCatalogVocabulary();
  const { data, isLoading } = useCatalog();
  const { data: activeCategories = [] } = useCategoryOptions();
  const [category, setCategory] = useState<string | undefined>();

  const products = data ?? [];
  const visible = filterByCategory(products, category);
  const filterOptions = [
    ...categoryFilterOptions(products, activeCategories),
    { value: NO_CATEGORY, label: t('product.filter.noCategory') },
  ];

  return (
    <div>
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              active
              title={false}
              paragraph={{ rows: 2 }}
              className="border-line rounded-lg border p-3"
            />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="flex flex-col gap-3">
          <Select
            className="w-full sm:w-64"
            allowClear
            value={category}
            onChange={(value?: string) => setCategory(value)}
            options={filterOptions}
            placeholder={t('product.filter.allCategories')}
            aria-label={t('product.filter.category')}
            showSearch={{ optionFilterProp: 'label' }}
          />
          {visible.length > 0 ? (
            <ProductList products={visible} allIds={products.map((p) => p.id)} />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('product.filter.emptyFiltered', vocabulary)}
              className="mt-16"
            />
          )}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('empty', vocabulary)}
          className="mt-16"
        />
      )}
    </div>
  );
}
