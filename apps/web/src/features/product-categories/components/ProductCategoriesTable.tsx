'use client';
import { useTranslation } from 'react-i18next';
import { paginationOf, type ProductCategoriesListQuery } from '@repo/schemas';
import { DataTable, useDataTable } from '@/components/shared/DataTable';
import {
  useDeleteProductCategory,
  useProductCategoriesList,
  useToggleProductCategoryActive,
} from '../hooks/useProductCategories';
import type { ProductCategory } from '../types';
import { useProductCategoriesColumns } from './columns';
import { ProductCategoryCard } from './ProductCategoryCard';

interface ProductCategoriesTableProps {
  onEdit: (category: ProductCategory) => void;
}

export function ProductCategoriesTable({ onEdit }: ProductCategoriesTableProps) {
  const { t } = useTranslation('productCategories');
  const { t: tc } = useTranslation('common');
  const table = useDataTable<ProductCategoriesListQuery['sortBy']>({
    defaultSortBy: 'sortOrder',
    defaultSortDir: 'asc',
  });
  const { data, isLoading } = useProductCategoriesList(table.query);
  const { toggleActive } = useToggleProductCategoryActive();
  const { deleteCategory } = useDeleteProductCategory();

  const onToggleActive = (category: ProductCategory) =>
    void toggleActive(category.id, !category.isActive).catch(() => {});
  const onDelete = (category: ProductCategory) => void deleteCategory(category.id).catch(() => {});
  const columns = useProductCategoriesColumns({ onEdit, onToggleActive, onDelete });

  return (
    <DataTable<ProductCategory>
      {...table.tableProps}
      rowKey="id"
      columns={columns}
      mobileRenderType="card"
      renderCard={(category) => (
        <ProductCategoryCard
          category={category}
          onEdit={onEdit}
          onToggleActive={onToggleActive}
          onDelete={onDelete}
        />
      )}
      dataSource={data?.items}
      loading={isLoading}
      total={paginationOf(data)?.total}
      searchPlaceholder={tc('table.search')}
      emptyText={t('empty')}
    />
  );
}
