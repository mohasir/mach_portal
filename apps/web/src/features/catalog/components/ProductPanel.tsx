'use client';
import { useState } from 'react';
import { Tag } from 'antd';
import { ChevronDown, ChevronRight, Power, PowerOff, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { DataTableRowActions, type RowActionItem } from '@/components/shared/DataTable';
import { useProductMutations } from '../hooks/useProductMutations';
import { useSortableRow } from '../hooks/useSortableRow';
import { useCatalogSortable } from '../hooks/useCatalogSortable';
import { ReorderControl } from './ReorderControl';
import { OptionGroupList } from './OptionGroupList';
import type { Product } from '../types';

interface ProductPanelProps {
  product: Product;
  onEdit: (product: Product) => void;
}

export function ProductPanel({ product, onEdit }: ProductPanelProps) {
  const { t } = useTranslation('catalog');
  const { t: tc } = useTranslation('common');
  const { toggleProductActive } = useProductMutations();
  const sortable = useCatalogSortable();
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableRow(product.id, sortable);
  const [expanded, setExpanded] = useState(false);

  const actions: RowActionItem[] = [
    {
      key: 'edit',
      guard: { [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] },
      onClick: () => onEdit(product),
    },
    {
      key: 'toggleActive',
      label: t(product.isActive ? 'actions.deactivate' : 'actions.activate'),
      icon: product.isActive ? <PowerOff size={16} /> : <Power size={16} />,
      guard: { [RESOURCES.PRODUCT]: [ACTIONS.UPDATE] },
      onClick: () => toggleProductActive(product.id, !product.isActive),
    },
  ];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border-line rounded-lg border p-3 ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ReorderControl dragHandleProps={dragHandleProps} />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className={`truncate font-medium ${product.isActive ? '' : 'text-muted'}`}>
            {product.name}
          </span>
        </button>
        {product.isPremium && (
          <Tag color="gold" icon={<Star size={12} />}>
            {t('product.premium')}
          </Tag>
        )}
        {!product.isActive && <Tag>{t('status.inactive')}</Tag>}
        <DataTableRowActions actions={actions} label={tc('table.actions')} />
      </div>

      {expanded && <OptionGroupList productId={product.id} groups={product.optionGroups} />}
    </div>
  );
}
