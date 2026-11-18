'use client';
import { Button, Empty, Form, Skeleton } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import { PageHeader } from '@/components/shared/PageHeader';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useProduct } from '../hooks/useCatalog';
import { useProductMutations } from '../hooks/useProductMutations';
import { taxFormValues, type ProductFormValues, type ProductPayload } from '../helpers';
import { NotQuotableAlert } from './NotQuotableAlert';
import { ProductForm } from './ProductForm';

interface ProductFormPageProps {
  productId?: string;
}

export function ProductFormPage({ productId }: ProductFormPageProps) {
  const { t } = useTranslation('catalog');
  const { t: tCommon } = useTranslation('common');
  const vocabulary = useCatalogVocabulary();
  const router = useRouter();
  const { createProduct, updateProduct, isPending } = useProductMutations();
  const [form] = Form.useForm<ProductFormValues>();
  const { data: product, isLoading } = useProduct(productId ?? '');

  const isEdit = !!productId;
  const backHref = isEdit ? `/admin/products/${productId}` : '/admin/products';

  const onSubmit = async (values: ProductPayload) => {
    try {
      if (product) {
        await updateProduct(product.id, values);
        router.push(backHref);
      } else {
        const created = await createProduct(values);
        router.replace(`/admin/products/${created.id}`);
      }
    } catch {
      // The error is already notified by useApiError.
    }
  };

  const title = t(isEdit ? 'product.edit.title' : 'product.create.title', vocabulary);

  return (
    <div>
      <PageHeader title={title} backHref={backHref} />

      {isEdit && isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : isEdit && !product ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('empty', vocabulary)}
          className="mt-16"
        />
      ) : (
        <WrapperCard>
          {product && !product.quotable && <NotQuotableAlert className="mb-4" />}
          <ProductForm
            form={form}
            initialValues={
              product
                ? {
                    name: product.name,
                    shortDescription: product.shortDescription ?? undefined,
                    longDescription: product.longDescription ?? undefined,
                    isPremium: product.isPremium,
                    price: product.price,
                    uomId: product.uomId,
                    sku: product.sku,
                    categoryId: product.categoryId,
                    cost: product.cost,
                    minQuantity: product.minQuantity,
                    ...taxFormValues(product, undefined),
                  }
                : undefined
            }
            currentUnit={product?.unit}
            currentCategory={product?.category}
            tiers={product?.priceTiers.map((tier) => ({
              quantity: tier.quantity,
              price: tier.price,
            }))}
            onSubmit={onSubmit}
          />
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button onClick={() => router.push(backHref)} className="w-full sm:w-auto">
              {tCommon('cancel')}
            </Button>
            <Button
              type="primary"
              loading={isPending}
              onClick={() => form.submit()}
              className="w-full sm:w-auto"
            >
              {t('form.save')}
            </Button>
          </div>
        </WrapperCard>
      )}
    </div>
  );
}
