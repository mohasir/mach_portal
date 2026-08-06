'use client';
import { useState } from 'react';
import { Empty } from 'antd';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { Product } from '@/features/catalog';
import { useCan } from '@/lib/auth/useCan';
import { QuickLineCard } from '@/features/quotes';
import { WrapperCard } from '@/components/shared/WrapperCard';
import type { EventDetail } from '../../types';
import { StationSelectionDetailSheet } from './StationSelectionDetailSheet';
import { StationSelectionsSheet } from './StationSelectionsSheet';

interface EventCompositionProps {
  event: EventDetail;
  lines: EventDetail['lines'];
  catalog: Product[];
}

type SheetLine = { line: EventDetail['lines'][number]; product: Product };

export function EventComposition({ event, lines, catalog }: EventCompositionProps) {
  const can = useCan();
  const [editing, setEditing] = useState<SheetLine | null>(null);
  const [viewing, setViewing] = useState<SheetLine | null>(null);

  const canManageSelections = can({ [RESOURCES.EVENT]: [ACTIONS.MANAGE_SELECTIONS] });

  return (
    <WrapperCard>
      {lines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="flex flex-col gap-3">
          {lines.map((line) => {
            const product = catalog.find((p) => p.id === line.productId);
            if (!product) return null;

            return canManageSelections ? (
              <QuickLineCard
                key={line.id}
                mode="selection"
                line={line}
                product={product}
                onShow={() => setViewing({ line, product })}
                onEditSelection={() => setEditing({ line, product })}
              />
            ) : (
              <QuickLineCard key={line.id} mode="readOnly" line={line} product={product} />
            );
          })}
        </div>
      )}
      {editing && (
        <StationSelectionsSheet
          eventId={event.id}
          line={editing.line}
          product={editing.product}
          open
          onClose={() => setEditing(null)}
        />
      )}
      {viewing && (
        <StationSelectionDetailSheet
          line={viewing.line}
          product={viewing.product}
          open
          onClose={() => setViewing(null)}
        />
      )}
    </WrapperCard>
  );
}
