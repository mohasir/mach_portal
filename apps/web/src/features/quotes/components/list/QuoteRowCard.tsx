'use client';
import { Card, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { QuoteStageId } from '@repo/schemas';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { useQuoteStages } from '@/features/settings';
import { useQuoteRowActions } from '../../hooks/useQuoteRowActions';
import type { Quote } from '../../types';

interface QuoteRowCardProps {
  row: Quote;
  onClick: () => void;
}

export function QuoteRowCard({ row, onClick }: QuoteRowCardProps) {
  const { t: tc } = useTranslation('common');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const { stageMap } = useQuoteStages();
  const rowActions = useQuoteRowActions();
  const stage = stageMap.get(row.stageId as QuoteStageId);

  return (
    <Card size="small" onClick={onClick} className="cursor-pointer">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{row.number}</span>
        <div className="flex items-center gap-1">
          <Tag color={stage?.color}>{stage?.label}</Tag>
          <div onClick={(e) => e.stopPropagation()}>
            <DataTableRowActions actions={rowActions(row)} label={tc('table.actions')} />
          </div>
        </div>
      </div>
      <div className="mt-1 text-sm text-gray-500">{row.clientName}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">{row.eventDate ? date(row.eventDate) : '—'}</span>
        <span className="font-medium">{money(row.total)}</span>
      </div>
    </Card>
  );
}
