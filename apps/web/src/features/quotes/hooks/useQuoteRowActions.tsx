'use client';
import { useRouter } from 'next/navigation';
import { Archive, CalendarDays, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { QUOTE_STAGE } from '@repo/schemas';
import type { RowActionItem } from '@/components/shared/DataTable';
import { useArchiveQuote, useCanArchiveQuote } from './useQuotes';

interface QuoteRowActionsRow {
  id: string;
  number: string;
  stageId: number;
  pdfUrl?: string | null;
  eventId?: string | null;
}

export function useQuoteRowActions() {
  const { t } = useTranslation('quotes');
  const router = useRouter();
  const { archiveQuote } = useArchiveQuote();
  const { canArchive } = useCanArchiveQuote();

  return (row: QuoteRowActionsRow): RowActionItem[] => {
    const isEditable = row.stageId === QUOTE_STAGE.PENDING || row.stageId === QUOTE_STAGE.QUOTED;

    return [
      {
        key: 'detail',
        onClick: () => router.push(`/admin/quotes/preview/${row.id}`),
      },
      ...(row.eventId
        ? ([
            {
              key: 'viewEvent',
              label: t('detail.viewEvent'),
              icon: <CalendarDays size={16} />,
              onClick: () => router.push(`/admin/events/${row.eventId}`),
            },
          ] as RowActionItem[])
        : []),
      ...(row.pdfUrl
        ? ([
            {
              key: 'viewPdf',
              label: t('detail.viewPdf'),
              icon: <Download size={16} />,
              onClick: () => window.open(row.pdfUrl!, '_blank'),
            },
          ] as RowActionItem[])
        : []),
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
        validate: async () => {
          const result = await canArchive(row.id);
          return result.canArchive
            ? { allowed: true }
            : {
                allowed: false,
                title: t('archive.blockedTitle'),
                content: t('archive.blockedContent'),
              };
        },
      },
    ];
  };
}
