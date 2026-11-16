'use client';
import { Tag } from 'antd';
import { useRouter } from 'next/navigation';
import { ChevronRight, Layers, Star, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getStationIcon } from '@/features/quotes';
import { IconBadge } from '@/components/shared/IconBadge';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { Feature } from '@/lib/auth/Feature';
import type { Product } from '../types';
import { NotQuotableTag } from './NotQuotableTag';

interface ProductPanelProps {
  product: Product;
}

export function ProductPanel({ product }: ProductPanelProps) {
  const { t } = useTranslation('catalog');
  const router = useRouter();

  return (
    <WrapperCard>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => router.push(`/admin/products/${product.id}`)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <IconBadge icon={getStationIcon(product.name)} shape="square" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`truncate font-medium ${product.isActive ? '' : 'text-muted'}`}>
                {product.name}
              </span>
              {product.isPremium && (
                <Tag color="gold" icon={<Star size={12} fill="currentColor" />}>
                  {t('product.premium')}
                </Tag>
              )}
              {!product.quotable && <NotQuotableTag />}
              {product.category && <Tag className="m-0">{product.category.name}</Tag>}
            </div>
            <div className="text-muted flex items-center gap-2 text-xs">
              <Feature name="configurableOptions">
                <span className="flex items-center gap-1">
                  <Layers size={12} className="shrink-0" />
                  {t('product.optionGroupsCount', { count: product.optionGroups.length })}
                </span>
              </Feature>
              <Feature name="priceTiers">
                <span className="flex items-center gap-1">
                  <Wallet size={12} className="shrink-0" />
                  {t('product.priceTiersCount', { count: product.priceTiers.length })}
                </span>
              </Feature>
            </div>
          </div>
          <ChevronRight size={16} className="text-muted shrink-0" />
        </button>
        {!product.isActive && <Tag>{t('status.inactive')}</Tag>}
      </div>
    </WrapperCard>
  );
}
