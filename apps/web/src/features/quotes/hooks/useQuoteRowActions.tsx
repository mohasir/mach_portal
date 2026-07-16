'use client';
import { useRouter } from 'next/navigation';
import { Archive } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE } from '@repo/schemas';
import type { RowActionItem } from '@/components/shared/DataTable';
import { useArchiveQuote } from './useQuotes';

export function useQuoteRowActions() {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const { archiveQuote } = useArchiveQuote();

  return (row: { id: string; number: string; stageId: number }): RowActionItem[] => {
    const isEditable = row.stageId === QUOTE_STAGE.PENDING || row.stageId === QUOTE_STAGE.QUOTED;

    return [
      {
        key: 'detail',
        onClick: () => router.push(`/admin/quotes/preview/${row.id}`),
      },
      ...(isEditable
        ? ([
            {
              key: 'edit',
              guard: { [RESOURCES.QUOTE]: [ACTIONS.UPDATE] },
              onClick: () => router.push(`/admin/quotes/${row.id}`),
            },
          ] as RowActionItem[])
        : []),
      { type: 'divider' },
      {
        key: 'archive',
        label: t('archive.action'),
        icon: <Archive size={16} />,
        danger: true,
        guard: { [RESOURCES.QUOTE]: [ACTIONS.DELETE] },
        onClick: () => void archiveQuote(row.id),
        confirm: {
          title: t('archive.confirmTitle'),
          content: t('archive.confirmContent', { number: row.number }),
        },
      },
    ];
  };
}
