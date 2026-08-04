'use client';
import { useEffect, useState } from 'react';
import { Button, Divider, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { EventLineSelectionInput } from '@repo/schemas';
import type { Product } from '@/features/catalog';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { getStationIcon, OptionGroupChips } from '@/features/quotes';
import { useUpdateEventSelections } from '../../hooks/useEventSelections';
import type { EventDetail } from '../../types';

interface EventSelectionsSheetProps {
  event: EventDetail;
  catalog: Product[];
  open: boolean;
  onClose: () => void;
}

// lineId -> optionGroupId -> optionIds
type SelectionsState = Record<string, Record<string, string[]>>;

function buildInitialState(event: EventDetail): SelectionsState {
  return Object.fromEntries(
    event.lines.map((line) => [
      line.id,
      Object.fromEntries(line.selections.map((s) => [s.optionGroupId, s.optionIds])),
    ]),
  );
}

export function EventSelectionsSheet({
  event,
  catalog,
  open,
  onClose,
}: EventSelectionsSheetProps) {
  const { t } = useTranslation('events');
  const [selections, setSelections] = useState<SelectionsState>(() => buildInitialState(event));
  const { updateSelections, isPending } = useUpdateEventSelections();

  useEffect(() => {
    if (open) setSelections(buildInitialState(event));
  }, [open, event]);

  const setLineGroupSelection = (lineId: string, groupId: string, optionIds: string[]) => {
    setSelections((prev) => ({ ...prev, [lineId]: { ...prev[lineId], [groupId]: optionIds } }));
  };

  const handleSave = async () => {
    const payload: EventLineSelectionInput[] = event.lines.flatMap((line) => {
      const product = catalog.find((p) => p.id === line.productId);
      return (product?.optionGroups ?? [])
        .filter((group) => group.selectionType === 'select')
        .map((group) => ({
          quoteLineId: line.id,
          optionGroupId: group.id,
          optionIds: selections[line.id]?.[group.id] ?? [],
        }));
    });
    try {
      await updateSelections({ eventId: event.id, selections: payload });
      onClose();
    } catch {
      // error notified by useApiError
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('detail.selections.sheetTitle')}>
      <div className="flex flex-col gap-4 p-4 pb-8">
        {event.lines.map((line) => {
          const product = catalog.find((p) => p.id === line.productId);
          if (!product) return null;
          const selectGroups = product.optionGroups.filter((g) => g.selectionType === 'select');
          if (selectGroups.length === 0) return null;
          const Icon = getStationIcon(product.name);
          return (
            <div key={line.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Icon size={16} className="text-brown shrink-0" />
                <Typography.Text strong>{product.name}</Typography.Text>
              </div>
              {selectGroups.map((group) => (
                <OptionGroupChips
                  key={group.id}
                  group={group}
                  selectedIds={selections[line.id]?.[group.id] ?? []}
                  onChange={(optionIds) => setLineGroupSelection(line.id, group.id, optionIds)}
                />
              ))}
              <Divider className="my-1" />
            </div>
          );
        })}
        <Button type="primary" block loading={isPending} onClick={() => void handleSave()}>
          {t('detail.selections.save')}
        </Button>
      </div>
    </BottomSheet>
  );
}
