'use client';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { CatalogPage } from './CatalogPage';

export function ProductsPage() {
  const { t } = useTranslation('catalog');
  const vocabulary = useCatalogVocabulary();
  const can = useCan();
  const canCreate = can({ [RESOURCES.PRODUCT]: [ACTIONS.CREATE] });
  const router = useRouter();
  const goToCreate = () => router.push('/admin/products/new');

  return (
    <div>
      <PageHeader
        title={t('breadcrumbRoot', vocabulary)}
        backHref="/admin/options"
        actionLabel={canCreate ? t('product.add', vocabulary) : undefined}
        onAction={canCreate ? goToCreate : undefined}
        mobileAction={
          canCreate
            ? {
                icon: Plus,
                onClick: goToCreate,
                ariaLabel: t('product.add', vocabulary),
              }
            : undefined
        }
      />

      <CatalogPage />
    </div>
  );
}
