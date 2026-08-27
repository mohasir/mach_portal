'use client';
import { useState } from 'react';
import { Button, Empty, Skeleton, Tabs, Tag, Typography } from 'antd';
import { Layers, Star, Wallet } from 'lucide-react';
import { TbRestore, TbTrashFilled } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { getStationIcon } from '@/features/quotes';
import { useActionConfirm } from '@/components/shared/ConfirmDialogs';
import { IconBadge } from '@/components/shared/IconBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useCan } from '@/lib/auth/useCan';
import { useProduct } from '../hooks/useCatalog';
import { useProductMutations } from '../hooks/useProductMutations';
import { OptionGroupList } from './OptionGroupList';
import { ProductFormModal } from './ProductFormModal';
import { PriceTiersForm } from './prices/PriceTiersForm';

interface ProductDetailPageProps {
  productId: string;
}

export function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const { t } = useTranslation('catalog');
  const can = useCan();
  const canEdit = can({ [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] });
  const canDisable = can({ [RESOURCES.PRODUCT]: [ACTIONS.DISABLE] });
  const canEnable = can({ [RESOURCES.PRODUCT]: [ACTIONS.ENABLE] });
  const { data: product, isLoading } = useProduct(productId);
  const { disableProduct, enableProduct } = useProductMutations();
  const [confirm, confirmContextHolder] = useActionConfirm();
  const [isEditOpen, setEditOpen] = useState(false);

  const handleDisable = () =>
    product &&
    confirm({
      title: t('product.disableConfirm.title'),
      content: t('product.disableConfirm.content'),
      danger: true,
      onOk: () => disableProduct(product.id),
    });

  const handleEnable = () =>
    product &&
    confirm({
      title: t('product.enableConfirm.title'),
      content: t('product.enableConfirm.content'),
      onOk: () => enableProduct(product.id),
    });

  const StationIcon = product && getStationIcon(product.name);

  return (
    <div>
      <PageHeader title={product?.name ?? t('breadcrumbRoot')} backHref="/admin/products" />

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : !product ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('empty')} className="mt-16" />
      ) : (
        <div className="flex flex-col gap-4">
          <WrapperCard>
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div className="bg-olive-faint text-brown flex size-16 shrink-0 items-center justify-center rounded-2xl">
                  {StationIcon && <StationIcon size={32} />}
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
                            className="bg-salmon/20 text-error"
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
              </div>

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

              <div className="divide-brown/10 flex items-stretch divide-x">
                <div className="flex items-center justify-center gap-1.5 px-1.5 py-1.5">
                  <Layers size={14} className="text-brown shrink-0" />
                  <span className="text-brown truncate text-sm font-medium">
                    {t('product.optionGroupsCount', { count: product.optionGroups.length })}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-1.5 px-1.5 py-1.5">
                  <Wallet size={14} className="text-brown shrink-0" />
                  <span className="text-brown truncate text-sm font-medium">
                    {t('product.priceTiersCount', { count: product.priceTiers.length })}
                  </span>
                </div>
              </div>

              {canEdit && (
                <Button type="primary" className="mt-2" onClick={() => setEditOpen(true)}>
                  {t('product.edit.title')}
                </Button>
              )}
            </div>
          </WrapperCard>

          <WrapperCard>
            <Tabs
              items={[
                {
                  key: 'details',
                  label: t('detail.tabs.details'),
                  children: (
                    <OptionGroupList productId={product.id} groups={product.optionGroups} />
                  ),
                },
                {
                  key: 'prices',
                  label: t('detail.tabs.prices'),
                  children: <PriceTiersForm product={product} canEdit={canEdit} />,
                },
              ]}
            />
          </WrapperCard>
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
