'use client';
import { useRouter } from 'next/navigation';
import { Divider, Tag } from 'antd';
import { AlertCircle, Eye, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE, type QuoteStageId } from '@repo/schemas';
import { DataTableRowActions } from '@/components/shared/DataTable';
import { IconButton } from '@/components/shared/IconButton';
import { IconTag } from '@/components/shared/IconTag';
import { QuoteAssignmentAvatars } from '@/components/shared/QuoteAssignmentAvatars';
import { useCan } from '@/lib/auth/useCan';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { useMoneyFormatter } from '@/lib/hooks/useMoneyFormatter';
import { useQuoteStages } from '@/features/settings';
import { useQuoteRowActions } from '../../hooks/useQuoteRowActions';
import type { Quote } from '../../types';
import { CopyableQuoteNumber } from '../CopyableQuoteNumber';
import { WrapperCard } from '@/components/shared/WrapperCard';

interface QuoteRowCardProps {
  row: Quote;
  onClick: () => void;
}

export function QuoteRowCard({ row, onClick }: QuoteRowCardProps) {
  const { t } = useTranslation('quotes');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const { date } = useDateFormatter();
  const { money } = useMoneyFormatter();
  const { stageMap } = useQuoteStages();
  const rowActions = useQuoteRowActions();
  const can = useCan();
  const stage = stageMap.get(row.stageId as QuoteStageId);
  const canEdit =
    (row.stageId === QUOTE_STAGE.PENDING || row.stageId === QUOTE_STAGE.QUOTED) &&
    can({ [RESOURCES.QUOTE]: [ACTIONS.UPDATE] });

  return (
    <WrapperCard onClick={onClick}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 w-full">
          <CopyableQuoteNumber number={row.number} className="font-medium" />
          <div onClick={(e) => e.stopPropagation()}>
            <DataTableRowActions actions={rowActions(row)} label={tc('table.actions')} />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tag color={stage?.color}>{stage?.label}</Tag>
          {row.isDraft && (
            <IconTag
              color={row.isComplete ? undefined : 'error'}
              icon={row.isComplete ? undefined : AlertCircle}
            >
              {t('pipeline.draftTag')}
            </IconTag>
          )}
        </div>
      </div>
      <div className="mt-1 text-base text-gray-500">{row.clientName}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-gray-500">{row.eventDate ? date(row.eventDate) : '—'}</span>
        <span className="font-medium">{money(row.total)}</span>
      </div>
      <Divider className="my-2" />
      {/* Also stops the sheet portal content from bubbling clicks up to the Card's
          onClick (React portals bubble through the component tree, not the DOM tree). */}
      <div onClick={(e) => e.stopPropagation()} className="flex items-center justify-between gap-2">
        <QuoteAssignmentAvatars
          quoteId={row.id}
          createdByName={row.createdByName}
          assignedToId={row.assignedToId}
          assignedToName={row.assignedToName}
          editable
        />
        <div className="flex items-center gap-2">
          <IconButton
            icon={Eye}
            size="sm"
            onClick={() => router.push(`/admin/quotes/preview/${row.id}`)}
            aria-label={tc('detail')}
            className="bg-primary text-ivory"
          />
          {canEdit && (
            <IconButton
              icon={Pencil}
              size="sm"
              onClick={() => router.push(`/admin/quotes/${row.id}`)}
              aria-label={tc('edit')}
              className="bg-primary text-ivory"
            />
          )}
        </div>
      </div>
    </WrapperCard>
  );
}
