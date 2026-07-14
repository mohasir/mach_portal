'use client';
import { useState } from 'react';
import { Tag } from 'antd';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { PriceTiersForm } from './PriceTiersForm';
import type { PriceItem } from '../../types';

interface PricePanelProps {
  product: PriceItem;
  canEdit: boolean;
}

export function PricePanel({ product, canEdit }: PricePanelProps) {
  const { t } = useTranslation('catalog');
  const { money } = useMoneyFormatter();
  const [expanded, setExpanded] = useState(false);

  const tiers = product.priceTiers;
  const minPrice = tiers.length > 0 ? Math.min(...tiers.map((tier) => tier.price)) : null;

  return (
    <div className="border-line rounded-lg border p-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span
          className={`min-w-0 flex-1 truncate font-medium ${product.isActive ? '' : 'text-muted'}`}
        >
          {product.name}
        </span>
        {minPrice != null ? (
          <Tag>{t('product.tiersSummary', { count: tiers.length, from: money(minPrice) })}</Tag>
        ) : (
          <Tag className="text-muted">{t('product.noTiers')}</Tag>
        )}
      </button>

      {expanded && (
        <div className="mt-3">
          <PriceTiersForm product={product} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}
