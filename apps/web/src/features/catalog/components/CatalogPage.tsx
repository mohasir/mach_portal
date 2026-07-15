'use client';
import { useState } from 'react';
import { Empty, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '../hooks/useCatalog';
import { ProductList } from './ProductList';
import { ProductFormModal } from './ProductFormModal';
import type { Product } from '../types';

interface CatalogPageProps {
  createOpen?: boolean;
  onCreateClose?: () => void;
}

export function CatalogPage({ createOpen = false, onCreateClose }: CatalogPageProps) {
  const { t } = useTranslation('catalog');
  const { data, isLoading } = useCatalog();
  const [editing, setEditing] = useState<Product | null>(null);

  return (
    <div>
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} active title={false} paragraph={{ rows: 2 }} className="border-line rounded-lg border p-3" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <ProductList products={data} onEdit={setEditing} />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('empty')} className="mt-16" />
      )}

      <ProductFormModal product={null} open={createOpen} onClose={() => onCreateClose?.()} />
      <ProductFormModal product={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
