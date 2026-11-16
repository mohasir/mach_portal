'use client';
import { useState } from 'react';
import { Button, Empty, Skeleton, Tabs, Tag, Typography } from 'antd';
import { Copy, Layers, Star, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TbRestore, TbTrashFilled } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { getStationIcon } from '@/features/quotes';
import { useActionConfirm } from '@/components/shared/ConfirmDialogs';
import { IconBadge } from '@/components/shared/IconBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { Feature } from '@/lib/auth/Feature';
import { useCan } from '@/lib/auth/useCan';
import { useFeature } from '@/lib/auth/useFeature';
import { formatQuantity, unitNoun } from '@/lib/format/quantity';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { getDetailTabs } from '../helpers';
import { useProduct } from '../hooks/useCatalog';
import { useProductMutations } from '../hooks/useProductMutations';
import { NotQuotableAlert } from './NotQuotableAlert';
import { NotQuotableTag } from './NotQuotableTag';
import { OptionGroupList } from './OptionGroupList';
import { ProductFormModal } from './ProductFormModal';
import { PriceTiersForm } from './prices/PriceTiersForm';

interface ProductDetailPageProps {
  productId: string;
}

export function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const { t } = useTranslation('catalog');
  const vocabulary = useCatalogVocabulary();
  const can = useCan();
  const canEdit = can({ [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] });
  const canDisable = can({ [RESOURCES.PRODUCT]: [ACTIONS.DISABLE] });
  const canEnable = can({ [RESOURCES.PRODUCT]: [ACTIONS.ENABLE] });
  const canDuplicate = can({ [RESOURCES.PRODUCT]: [ACTIONS.DUPLICATE] });
  const canSeeCost = can({ [RESOURCES.PRODUCT_COST]: [ACTIONS.READ] });
  const router = useRouter();
  const priceTiers = useFeature('priceTiers');
  const configurableOptions = useFeature('configurableOptions');
  const { money } = useMoneyFormatter();
  const detailTabs = getDetailTabs({ priceTiers, configurableOptions });
  const { data: product, isLoading } = useProduct(productId);
  const { disableProduct, enableProduct, duplicateProduct, isDuplicating } = useProductMutations();
  const [confirm, confirmContextHolder] = useActionConfirm();
  const [isEditOpen, setEditOpen] = useState(false);

  const handleDisable = () =>
    product &&
    confirm({
      title: t('product.disableConfirm.title', vocabulary),
      content: t('product.disableConfirm.content'),
      danger: true,
      onOk: () => disableProduct(product.id),
    });

  const handleDuplicate = () =>
    product &&
    confirm({
      title: t('product.duplicateConfirm.title', vocabulary),
      content: t('product.duplicateConfirm.content'),
      onOk: async () => {
        const copy = await duplicateProduct(product.id);
        router.push(`/admin/products/${copy.id}`);
      },
    });

  const handleEnable = () =>
    product &&
    confirm({
      title: t('product.enableConfirm.title', vocabulary),
      content: t('product.enableConfirm.content'),
      onOk: () => enableProduct(product.id),
    });

  const ProductIcon = product && getStationIcon(product.name);

  return (
    <div>
      <PageHeader
        title={product?.name ?? t('breadcrumbRoot', vocabulary)}
        backHref="/admin/products"
      />

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : !product ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('empty', vocabulary)}
          className="mt-16"
        />
      ) : (
        <div className="flex flex-col gap-4">
          <WrapperCard>
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="bg-mist text-navy flex size-16 shrink-0 items-center justify-center rounded-2xl">
                  {ProductIcon && <ProductIcon size={32} />}
                </div>
                {product.isActive
                  ? canDisable && (
                      <Button
                        type="text"
                        danger
                        shape="square"
                        icon={
                          <IconBadge
                            icon={TbTrashFilled}
                            shape="square"
                            className="bg-error/20 text-error"
                          />
                        }
                        onClick={handleDisable}
                        aria-label={t('actions.deactivate')}
                      />
                    )
                  : canEnable && (
                      <Button
                        type="text"
                        icon={<TbRestore size={16} />}
                        onClick={handleEnable}
                        aria-label={t('actions.activate')}
                      />
                    )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Typography.Title level={2} className="m-0!">
                  {product.name}
                </Typography.Title>
                {product.isPremium && (
                  <Tag color="gold" icon={<Star size={12} fill="currentColor" />}>
                    {t('product.premium')}
                  </Tag>
                )}
                {!product.isActive && <Tag>{t('status.inactive')}</Tag>}
                {!product.quotable && <NotQuotableTag />}
              </div>

              {!product.quotable && <NotQuotableAlert />}

              {product.description && (
                <div>
                  <Typography.Text strong className="block text-sm">
                    {t('product.form.description')}
                  </Typography.Text>
                  <Typography.Text type="secondary" className="block text-sm">
                    {product.description}
                  </Typography.Text>
                </div>
              )}

              <div>
                <Typography.Text strong className="block text-sm">
                  {t('product.form.unit')}
                </Typography.Text>
                <Typography.Text type="secondary" className="block text-sm">
                  {product.unit.name} ({product.unit.code})
                </Typography.Text>
              </div>

              <div>
                <Typography.Text strong className="block text-sm">
                  {t('product.detailFields.minQuantity')}
                </Typography.Text>
                <Typography.Text type="secondary" className="block text-sm">
                  {formatQuantity(product.minQuantity, product.unit)}
                </Typography.Text>
              </div>

              {product.sku && (
                <div>
                  <Typography.Text strong className="block text-sm">
                    {t('product.detailFields.sku')}
                  </Typography.Text>
                  <Typography.Text type="secondary" className="block text-sm">
                    {product.sku}
                  </Typography.Text>
                </div>
              )}

              {product.category && (
                <div>
                  <Typography.Text strong className="block text-sm">
                    {t('product.detailFields.category')}
                  </Typography.Text>
                  <Typography.Text type="secondary" className="block text-sm">
                    {product.category.name}
                  </Typography.Text>
                </div>
              )}

              {product.price != null && (
                <div>
                  <Typography.Text strong className="block text-sm">
                    {t('product.form.price')}
                  </Typography.Text>
                  <Typography.Text type="secondary" className="block text-sm">
                    {t('product.pricePerUnit', {
                      price: money(product.price),
                      unit: unitNoun(product.unit, 1),
                    })}
                  </Typography.Text>
                </div>
              )}

              {canSeeCost && product.cost != null && (
                <div>
                  <Typography.Text strong className="block text-sm">
                    {t('product.detailFields.cost')}
                  </Typography.Text>
                  <Typography.Text type="secondary" className="block text-sm">
                    {money(product.cost)}
                  </Typography.Text>
                </div>
              )}

              <div className="divide-navy/10 flex items-stretch divide-x">
                <Feature name="configurableOptions">
                  <div className="flex items-center justify-center gap-1.5 px-1.5 py-1.5">
                    <Layers size={14} className="text-navy shrink-0" />
                    <span className="text-navy truncate text-sm font-medium">
                      {t('product.optionGroupsCount', { count: product.optionGroups.length })}
                    </span>
                  </div>
                </Feature>
                <Feature name="priceTiers">
                  <div className="flex items-center justify-center gap-1.5 px-1.5 py-1.5">
                    <Wallet size={14} className="text-navy shrink-0" />
                    <span className="text-navy truncate text-sm font-medium">
                      {t('product.priceTiersCount', { count: product.priceTiers.length })}
                    </span>
                  </div>
                </Feature>
              </div>

              {canEdit && (
                <Button type="primary" className="mt-2" onClick={() => setEditOpen(true)}>
                  {t('product.edit.title', vocabulary)}
                </Button>
              )}
              {canDuplicate && (
                <Button icon={<Copy size={16} />} loading={isDuplicating} onClick={handleDuplicate}>
                  {t('actions.duplicate')}
                </Button>
              )}
            </div>
          </WrapperCard>

          {detailTabs.length > 0 && (
            <WrapperCard>
              <Tabs
                items={detailTabs.map((tab) =>
                  tab === 'details'
                    ? {
                        key: tab,
                        label: t('detail.tabs.details'),
                        children: (
                          <OptionGroupList productId={product.id} groups={product.optionGroups} />
                        ),
                      }
                    : {
                        key: tab,
                        label: t('detail.tabs.prices'),
                        children: <PriceTiersForm product={product} />,
                      },
                )}
              />
            </WrapperCard>
          )}
        </div>
      )}

      <ProductFormModal
        product={product ?? null}
        open={isEditOpen}
        onClose={() => setEditOpen(false)}
      />

      {confirmContextHolder}
    </div>
  );
}
