'use client';
import { Empty, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '../hooks/useCatalog';
import { ProductList } from './ProductList';
import type { Product } from '../types';

interface CatalogPageProps {
  onEdit: (product: Product) => void;
}

export function CatalogPage({ onEdit }: CatalogPageProps) {
  const { t } = useTranslation('catalog');
  const { data, isLoading } = useCatalog();

  return (
    <div>
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} active title={false} paragraph={{ rows: 2 }} className="border-line rounded-lg border p-3" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <ProductList products={data} onEdit={onEdit} />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('empty')} className="mt-16" />
      )}
    </div>
  );
}
