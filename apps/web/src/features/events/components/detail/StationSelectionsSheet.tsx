'use client';
import { useEffect, useState } from 'react';
import { Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { EventLineSelectionInput } from '@repo/schemas';
import type { Product } from '@/features/catalog';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { getStationIcon, OptionGroupChips } from '@/features/quotes';
import { useUpdateEventSelections } from '../../hooks/useEventSelections';
import type { EventDetail } from '../../types';

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
  const Icon = getStationIcon(product.name);

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
    <BottomSheet open={open} onClose={onClose} title={t('detail.selections.sheetTitle')}>
      <div className="flex flex-col gap-4 p-4 pb-8">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-brown shrink-0" />
          <Typography.Text strong>{product.name}</Typography.Text>
        </div>
        {selectGroups.map((group) => (
          <OptionGroupChips
            key={group.id}
            group={group}
            selectedIds={selections[group.id] ?? []}
            onChange={(optionIds) => setSelections((prev) => ({ ...prev, [group.id]: optionIds }))}
          />
        ))}
        <Button type="primary" block loading={isPending} onClick={() => void handleSave()}>
          {t('detail.selections.save')}
        </Button>
      </div>
    </BottomSheet>
  );
}
