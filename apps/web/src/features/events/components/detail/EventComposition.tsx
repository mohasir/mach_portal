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
  // Line data and open-state are tracked separately: closing only flips `*Open` to
  // false, it never clears `editing`/`viewing`. Unmounting the sheet (or blanking its
  // content) the same render `open` goes false confuses AntD's Drawer size="auto"
  // close animation — the panel gets stuck visible with no mask.
  const [editing, setEditing] = useState<SheetLine | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);
  const [viewing, setViewing] = useState<SheetLine | null>(null);
  const [viewingOpen, setViewingOpen] = useState(false);

  const canManageSelections = can({ [RESOURCES.EVENT]: [ACTIONS.MANAGE_SELECTIONS] });

  const openViewing = (sheetLine: SheetLine) => {
    setViewing(sheetLine);
    setViewingOpen(true);
  };
  const openEditing = (sheetLine: SheetLine) => {
    setEditing(sheetLine);
    setEditingOpen(true);
  };

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
                onShow={() => openViewing({ line, product })}
                onEditSelection={() => openEditing({ line, product })}
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
          open={editingOpen}
          onClose={() => setEditingOpen(false)}
        />
      )}
      {viewing && (
        <StationSelectionDetailSheet
          line={viewing.line}
          product={viewing.product}
          open={viewingOpen}
          onClose={() => setViewingOpen(false)}
        />
      )}
    </WrapperCard>
  );
}
