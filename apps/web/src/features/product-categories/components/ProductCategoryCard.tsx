'use client';
import { Card, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import { useProductCategoryRowActions } from '../hooks/useProductCategoryRowActions';
import type { ProductCategory } from '../types';
import { ProductCategoryStatusTag } from './ProductCategoryStatusTag';

interface ProductCategoryCardProps {
  category: ProductCategory;
  onEdit: (category: ProductCategory) => void;
  onToggleActive: (category: ProductCategory) => void;
  onDelete: (category: ProductCategory) => void;
}

export function ProductCategoryCard({
  category,
  onEdit,
  onToggleActive,
  onDelete,
}: ProductCategoryCardProps) {
  const { t } = useTranslation('productCategories');
  const { t: tc } = useTranslation('common');
  const vocabulary = useCatalogVocabulary();
  const rowActions = useProductCategoryRowActions({ onEdit, onToggleActive, onDelete });

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Typography.Text strong className="truncate text-base">
            {category.name}
          </Typography.Text>
          <Typography.Text type="secondary" className="text-sm">
            {t('productCount', { count: category.productCount, ...vocabulary })}
          </Typography.Text>
        </div>
        <DataTableRowActions actions={rowActions(category)} label={tc('table.actions')} />
      </div>

      <Flex wrap gap={8} align="center" className="mt-3">
        <ProductCategoryStatusTag category={category} />
      </Flex>
    </Card>
  );
}
