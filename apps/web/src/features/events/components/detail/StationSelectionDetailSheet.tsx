'use client';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { OptionGroupSelectList } from '@/features/quotes';
import type { EventDetail } from '../../types';
import { StationSheetHeader } from './StationSheetHeader';

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

  const groups = product.optionGroups.filter((group) => {
    if (group.selectionType === 'included') return group.options.length > 0;
    const selection = line.selections.find((s) => s.optionGroupId === group.id);
    return !!selection?.optionIds.length;
  });

  return (
    <BottomSheet open={open} onClose={onClose} title={t('detail.selections.detailTitle')}>
      <div className="flex flex-col gap-4 px-4 pb-8">
        <StationSheetHeader product={product} numPersons={line.numPersons} subtotal={line.subtotal} />
        {groups.map((group) => (
          <OptionGroupSelectList
            key={group.id}
            group={group}
            selectedIds={line.selections.find((s) => s.optionGroupId === group.id)?.optionIds ?? []}
            readOnly
          />
        ))}
      </div>
    </BottomSheet>
  );
}
