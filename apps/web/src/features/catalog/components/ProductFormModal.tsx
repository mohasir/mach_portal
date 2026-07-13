'use client';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateProductInput } from '@repo/schemas';
import { useProductMutations } from '../hooks/useProductMutations';
import { ProductForm } from './ProductForm';
import type { Product } from '../types';

interface ProductFormModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

export function ProductFormModal({ product, open, onClose }: ProductFormModalProps) {
  const { t } = useTranslation('catalog');
  const { createProduct, updateProduct, isPending } = useProductMutations();

  const onSubmit = async (values: UpdateProductInput) => {
    try {
      if (product) await updateProduct(product.id, values);
      else await createProduct(values);
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={t(product ? 'product.edit.title' : 'product.create.title')}
    >
      {open && (
        <ProductForm
          key={product?.id ?? 'create'}
          initialValues={
            product
              ? {
                  name: product.name,
                  description: product.description ?? undefined,
                  basePriceUsd: product.basePrice / 100,
                  isPremium: product.isPremium,
                }
              : undefined
          }
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </Modal>
  );
}
