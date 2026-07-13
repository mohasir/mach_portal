'use client';
import { useState } from 'react';
import { Empty, Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { useCatalog } from '../hooks/useCatalog';
import { ProductList } from './ProductList';
import { ProductFormModal } from './ProductFormModal';
import type { Product } from '../types';

export function CatalogPage() {
  const { t } = useTranslation('catalog');
  const can = useCan();
  const canCreate = can({ [RESOURCES.PRODUCT]: [ACTIONS.CREATE] });
  const { data, isLoading } = useCatalog();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  return (
    <div>
      <PageHeader
        title={t('title')}
        actionLabel={canCreate ? t('product.add') : undefined}
        onAction={canCreate ? () => setCreateOpen(true) : undefined}
      />

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

      <ProductFormModal product={null} open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <ProductFormModal product={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
