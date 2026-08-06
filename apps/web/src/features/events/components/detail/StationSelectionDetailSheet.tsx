'use client';
import { Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { getStationIcon } from '@/features/quotes';
import type { EventDetail } from '../../types';

interface StationSelectionDetailSheetProps {
  line: EventDetail['lines'][number];
  product: Product;
  open: boolean;
  onClose: () => void;
}

export function StationSelectionDetailSheet({
  line,
  product,
  open,
  onClose,
}: StationSelectionDetailSheetProps) {
  const { t } = useTranslation('events');
  const { t: tq } = useTranslation('quotes');
  const Icon = getStationIcon(product.name);

  const groups = product.optionGroups
    .map((group) => {
      const isIncluded = group.selectionType === 'included';
      const selection = line.selections.find((s) => s.optionGroupId === group.id);
      const options = isIncluded
        ? group.options
        : group.options.filter((o) => selection?.optionIds.includes(o.id));
      return {
        key: group.id,
        label: group.label,
        isIncluded,
        optionNames: options.map((o) => o.name),
      };
    })
    .filter((group) => group.optionNames.length > 0);

  return (
    <BottomSheet open={open} onClose={onClose} title={t('detail.selections.detailTitle')}>
      <div className="flex flex-col gap-4 p-4 pb-8">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-brown shrink-0" />
          <Typography.Text strong>{product.name}</Typography.Text>
        </div>
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">
              {group.label}
              {group.isIncluded ? ` | ${tq('detail.includedLabel')}` : ''}
            </span>
            <span className="text-base">{group.optionNames.join(', ')}</span>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
