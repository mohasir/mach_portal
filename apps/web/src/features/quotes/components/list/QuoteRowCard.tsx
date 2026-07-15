'use client';
import { Card, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { QUOTE_STAGE_COLORS } from '../../helpers';
import type { Quote } from '../../types';

interface QuoteRowCardProps {
  row: Quote;
  onClick: () => void;
}

export function QuoteRowCard({ row, onClick }: QuoteRowCardProps) {
  const { t } = useTranslation('quotes');
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();

  return (
    <Card size="small" onClick={onClick} className="cursor-pointer">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{row.number}</span>
        <Tag color={QUOTE_STAGE_COLORS[row.stage]}>{t(`stage.${row.stage}`)}</Tag>
      </div>
      <div className="mt-1 text-sm text-gray-500">{row.clientName}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">{row.eventDate ? date(row.eventDate) : '—'}</span>
        <span className="font-medium">{money(row.total)}</span>
      </div>
    </Card>
  );
}
