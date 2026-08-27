'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { CatalogPage } from './CatalogPage';
import { ProductFormModal } from './ProductFormModal';

export function ProductsPage() {
  const { t } = useTranslation('catalog');
  const can = useCan();
  const canCreate = can({ [RESOURCES.PRODUCT]: [ACTIONS.CREATE] });
  const [isCreateOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title={t('breadcrumbRoot')}
        backHref="/admin/options"
        actionLabel={canCreate ? t('product.add') : undefined}
        onAction={canCreate ? () => setCreateOpen(true) : undefined}
        mobileAction={
          canCreate
            ? { icon: Plus, onClick: () => setCreateOpen(true), ariaLabel: t('product.add') }
            : undefined
        }
      />

      <CatalogPage />

      <ProductFormModal product={null} open={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
