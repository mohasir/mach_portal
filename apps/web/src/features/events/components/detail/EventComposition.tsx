'use client';
import { useState } from 'react';
import { Button, Card, Empty } from 'antd';
import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { Product } from '@/features/catalog';
import { useCan } from '@/lib/auth/useCan';
import { getStationIcon, QuoteLineItem } from '@/features/quotes';
import type { EventDetail } from '../../types';
import { EventSelectionsSheet } from './EventSelectionsSheet';

interface EventCompositionProps {
  event: EventDetail;
  lines: EventDetail['lines'];
  catalog: Product[];
}

export function EventComposition({ event, lines, catalog }: EventCompositionProps) {
  const { t } = useTranslation('events');
  const can = useCan();
  const [sheetOpen, setSheetOpen] = useState(false);

  const canManageSelections = can({ [RESOURCES.EVENT]: [ACTIONS.MANAGE_SELECTIONS] });
  const hasSelectableGroups = lines.some((line) => {
    const product = catalog.find((p) => p.id === line.productId);
    return product?.optionGroups.some((g) => g.selectionType === 'select') ?? false;
  });

  return (
    <Card
      size="small"
      title={t('detail.composition.title')}
      extra={
        canManageSelections &&
        hasSelectableGroups && (
          <Button size="small" icon={<ListChecks size={14} />} onClick={() => setSheetOpen(true)}>
            {t('detail.selections.editButton')}
          </Button>
        )
      }
    >
      {lines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="flex flex-col">
          {lines.map((line) => {
            const product = catalog.find((p) => p.id === line.productId);
            if (!product) return null;
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
                  optionNames: options.map((option) => option.name),
                };
              })
              .filter((group) => group.optionNames.length > 0);

            return (
              <QuoteLineItem
                key={line.id}
                icon={getStationIcon(product.name)}
                name={product.name}
                numPersons={line.numPersons}
                total={line.subtotal}
                groups={groups}
              />
            );
          })}
        </div>
      )}
      {canManageSelections && (
        <EventSelectionsSheet
          event={event}
          catalog={catalog}
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </Card>
  );
}
