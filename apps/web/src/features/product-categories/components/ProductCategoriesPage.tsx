'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import type { ProductCategory } from '../types';
import { CreateProductCategoryModal } from './CreateProductCategoryModal';
import { EditProductCategoryModal } from './EditProductCategoryModal';
import { ProductCategoriesTable } from './ProductCategoriesTable';

export function ProductCategoriesPage() {
  const { t } = useTranslation('productCategories');
  const can = useCan();
  const canCreate = can({ [RESOURCES.PRODUCT_CATEGORY]: [ACTIONS.CREATE] });
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);

  return (
    <div>
      <PageHeader
        title={t('title')}
        backHref="/admin/options"
        actionLabel={canCreate ? t('index.add') : undefined}
        onAction={canCreate ? () => setCreateOpen(true) : undefined}
        mobileAction={
          canCreate
            ? { icon: Plus, onClick: () => setCreateOpen(true), ariaLabel: t('index.add') }
            : undefined
        }
      />
      <ProductCategoriesTable onEdit={setEditing} />
      <CreateProductCategoryModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <EditProductCategoryModal
        category={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}
