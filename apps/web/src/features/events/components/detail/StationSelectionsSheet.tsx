'use client';
import { useEffect, useState } from 'react';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import type { EventLineSelectionInput } from '@repo/schemas';
import type { Product } from '@/features/catalog';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { OptionGroupSelectList } from '@/features/quotes';
import { useUpdateEventSelections } from '../../hooks/useEventSelections';
import type { EventDetail } from '../../types';
import { StationSheetHeader } from './StationSheetHeader';

interface StationSelectionsSheetProps {
  eventId: string;
  line: EventDetail['lines'][number];
  product: Product;
  open: boolean;
  onClose: () => void;
}

type GroupSelections = Record<string, string[]>;

function buildInitialState(line: EventDetail['lines'][number]): GroupSelections {
  return Object.fromEntries(line.selections.map((s) => [s.optionGroupId, s.optionIds]));
}

export function StationSelectionsSheet({
  eventId,
  line,
  product,
  open,
  onClose,
}: StationSelectionsSheetProps) {
  const { t } = useTranslation('events');
  const [selections, setSelections] = useState<GroupSelections>(() => buildInitialState(line));
  const { updateSelections, isPending } = useUpdateEventSelections();

  useEffect(() => {
    if (open) setSelections(buildInitialState(line));
  }, [open, line]);

  const selectGroups = product.optionGroups.filter((g) => g.selectionType === 'select');

  const handleSave = async () => {
    const payload: EventLineSelectionInput[] = selectGroups.map((group) => ({
      quoteLineId: line.id,
      optionGroupId: group.id,
      optionIds: selections[group.id] ?? [],
    }));
    try {
      await updateSelections({ eventId, selections: payload });
      onClose();
    } catch {
      // error notified by useApiError
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('detail.selections.sheetTitle')}
      footerClassName="shadow-[0_-4px_8px_-2px_rgba(0,0,0,0.08)]"
      footer={
        <div className="py-2 pt-4">
          <Button type="primary" block loading={isPending} onClick={() => void handleSave()}>
            {t('detail.selections.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 px-4 pb-4">
        <StationSheetHeader
          product={product}
          numPersons={line.numPersons}
          subtotal={line.subtotal}
        />
        <div className="flex flex-col gap-2">
          {selectGroups.map((group) => (
            <OptionGroupSelectList
              key={group.id}
              group={group}
              selectedIds={selections[group.id] ?? []}
              onChange={(optionIds) =>
                setSelections((prev) => ({ ...prev, [group.id]: optionIds }))
              }
            />
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
