'use client';
import type { TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import { useProductCategoryRowActions } from '../hooks/useProductCategoryRowActions';
import type { ProductCategory } from '../types';
import { ProductCategoryStatusTag } from './ProductCategoryStatusTag';

interface UseProductCategoriesColumnsParams {
  onEdit: (category: ProductCategory) => void;
  onToggleActive: (category: ProductCategory) => void;
  onDelete: (category: ProductCategory) => void;
}

export function useProductCategoriesColumns(
  params: UseProductCategoriesColumnsParams,
): TableColumnsType<ProductCategory> {
  const { t } = useTranslation('productCategories');
  const { t: tc } = useTranslation('common');
  const vocabulary = useCatalogVocabulary();
  const rowActions = useProductCategoryRowActions(params);

  return [
    { title: t('columns.name'), dataIndex: 'name', key: 'name', sorter: true },
    {
      title: t('columns.products', vocabulary),
      dataIndex: 'productCount',
      key: 'productCount',
      responsive: ['sm'],
    },
    {
      title: t('columns.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      sorter: true,
      render: (_, category) => <ProductCategoryStatusTag category={category} />,
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_, category) => (
        <DataTableRowActions actions={rowActions(category)} label={tc('table.actions')} />
      ),
    },
  ];
}
