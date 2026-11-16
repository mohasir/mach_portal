'use client';
import { useTranslation } from 'react-i18next';
import type { UpdateProductCategoryInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useUpdateProductCategory } from '../hooks/useProductCategories';
import type { ProductCategory } from '../types';
import { ProductCategoryForm } from './ProductCategoryForm';

interface EditProductCategoryModalProps {
  category: ProductCategory | null;
  open: boolean;
  onClose: () => void;
}

export function EditProductCategoryModal({
  category,
  open,
  onClose,
}: EditProductCategoryModalProps) {
  const { t } = useTranslation('productCategories');
  const { updateCategory, isPending } = useUpdateProductCategory();

  const onSubmit = async (values: UpdateProductCategoryInput) => {
    if (!category) return;
    try {
      await updateCategory(category.id, values);
      onClose();
    } catch {
      // Surfaced by useApiError.
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('edit.title')}>
      {category && (
        <ProductCategoryForm
          key={category.id}
          category={category}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </WrapperModal>
  );
}
