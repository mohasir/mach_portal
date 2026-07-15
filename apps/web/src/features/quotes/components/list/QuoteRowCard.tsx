'use client';
import { Card, Tag } from 'antd';
import type { QuoteStageId } from '@repo/schemas';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { useQuoteStages } from '@/features/settings';
import type { Quote } from '../../types';

interface QuoteRowCardProps {
  row: Quote;
  onClick: () => void;
}

export function QuoteRowCard({ row, onClick }: QuoteRowCardProps) {
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const { stageMap } = useQuoteStages();
  const stage = stageMap.get(row.stageId as QuoteStageId);

  return (
    <Card size="small" onClick={onClick} className="cursor-pointer">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{row.number}</span>
        <Tag color={stage?.color}>{stage?.label}</Tag>
      </div>
      <div className="mt-1 text-sm text-gray-500">{row.clientName}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">{row.eventDate ? date(row.eventDate) : '—'}</span>
        <span className="font-medium">{money(row.total)}</span>
      </div>
    </Card>
  );
}
