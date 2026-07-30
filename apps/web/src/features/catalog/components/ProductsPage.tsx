'use client';
import { useState } from 'react';
import { Card } from 'antd';
import { ChevronRight, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { SectionMenu, type SectionMenuItem } from '@/components/shared/SectionMenu';
import { useCan } from '@/lib/auth/useCan';
import { CatalogPage } from './CatalogPage';
import { PricesPage } from './prices/PricesPage';

type ProductsSection = 'estaciones' | 'precios';

export function ProductsPage() {
  const { t } = useTranslation('catalog');
  const can = useCan();
  const canCreate = can({ [RESOURCES.PRODUCT]: [ACTIONS.CREATE] });
  const [section, setSection] = useState<ProductsSection>('estaciones');
  const [isCreateOpen, setCreateOpen] = useState(false);

  const menuItems: SectionMenuItem[] = [
    { key: 'estaciones', label: t('title') },
    { key: 'precios', label: t('prices.title') },
  ];

  const sectionLabel = section === 'estaciones' ? t('title') : t('prices.title');
  const showCreateAction = section === 'estaciones' && canCreate;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-1">
            <span className="whitespace-nowrap">{t('breadcrumbRoot')}</span>
            <ChevronRight size={20} className="text-muted shrink-0" />
            <span className="text-muted font-sans text-base font-normal whitespace-nowrap">
              {sectionLabel}
            </span>
          </span>
        }
        backHref="/admin/options"
        actionLabel={showCreateAction ? t('product.add') : undefined}
        onAction={showCreateAction ? () => setCreateOpen(true) : undefined}
        mobileAction={
          showCreateAction
            ? { icon: Plus, onClick: () => setCreateOpen(true), ariaLabel: t('product.add') }
            : undefined
        }
      />

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-6">
        <Card className="md:sticky md:top-4 md:self-start" classNames={{ body: 'p-2' }}>
          <SectionMenu
            items={menuItems}
            activeKey={section}
            onSelect={(key) => setSection(key as ProductsSection)}
          />
        </Card>

        <Card className="min-w-0 flex-1">
          {section === 'estaciones' && (
            <CatalogPage createOpen={isCreateOpen} onCreateClose={() => setCreateOpen(false)} />
          )}
          {section === 'precios' && <PricesPage />}
        </Card>
      </div>
    </div>
  );
}
