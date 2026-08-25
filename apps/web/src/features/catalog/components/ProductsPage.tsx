'use client';
import { useState } from 'react';
import { Segmented } from 'antd';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { CatalogPage } from './CatalogPage';
import { ProductFormModal } from './ProductFormModal';
import { PricesPage } from './prices/PricesPage';
import type { Product } from '../types';

type ProductsSection = 'estaciones' | 'precios';

export function ProductsPage() {
  const { t } = useTranslation('catalog');
  const can = useCan();
  const canCreate = can({ [RESOURCES.PRODUCT]: [ACTIONS.CREATE] });
  const [section, setSection] = useState<ProductsSection>('estaciones');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

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

      <Segmented
        block
        className="mb-4"
        value={section}
        onChange={(value) => setSection(value as ProductsSection)}
        options={[
          { value: 'estaciones', label: t('title') },
          { value: 'precios', label: t('prices.title') },
        ]}
      />

      {section === 'estaciones' && <CatalogPage onEdit={setEditing} />}
      {section === 'precios' && <PricesPage />}

      <ProductFormModal product={null} open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <ProductFormModal product={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
