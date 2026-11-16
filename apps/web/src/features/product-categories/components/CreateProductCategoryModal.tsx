'use client';
import { useTranslation } from 'react-i18next';
import type { CreateProductCategoryInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useCreateProductCategory } from '../hooks/useProductCategories';
import { ProductCategoryForm } from './ProductCategoryForm';

interface CreateProductCategoryModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateProductCategoryModal({ open, onClose }: CreateProductCategoryModalProps) {
  const { t } = useTranslation('productCategories');
  const { createCategory, isPending } = useCreateProductCategory();

  const onSubmit = async (values: CreateProductCategoryInput) => {
    try {
      await createCategory(values);
      onClose();
    } catch {
      // Surfaced by useApiError.
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('create.title')}>
      {open && <ProductCategoryForm onSubmit={onSubmit} isPending={isPending} />}
    </WrapperModal>
  );
}
