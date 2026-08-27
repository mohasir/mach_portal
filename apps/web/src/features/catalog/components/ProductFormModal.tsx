'use client';
import { useEffect } from 'react';
import { Button, Form } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateProductInput } from '@repo/schemas';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { useProductMutations } from '../hooks/useProductMutations';
import { ProductForm, type ProductFormValues } from './ProductForm';
import type { Product } from '../types';

interface ProductFormModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
}

export function ProductFormModal({ product, open, onClose }: ProductFormModalProps) {
  const { t } = useTranslation('catalog');
  const { createProduct, updateProduct, isPending } = useProductMutations();
  const [form] = Form.useForm<ProductFormValues>();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, product, form]);

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
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t(product ? 'product.edit.title' : 'product.create.title')}
      footerClassName="shadow-[0_-4px_8px_-2px_rgba(0,0,0,0.08)]"
      footer={
        <div className="py-2 pt-4">
          <Button type="primary" block loading={isPending} onClick={() => form.submit()}>
            {t('form.save')}
          </Button>
        </div>
      }
    >
      {open && (
        <div className="p-4">
          <ProductForm
            key={product?.id ?? 'create'}
            form={form}
            initialValues={
              product
                ? {
                    name: product.name,
                    description: product.description ?? undefined,
                    isPremium: product.isPremium,
                  }
                : undefined
            }
            tiers={product?.priceTiers.map((tier) => ({
              numPersons: tier.numPersons,
              price: tier.price,
            }))}
            onSubmit={onSubmit}
          />
        </div>
      )}
    </BottomSheet>
  );
}
