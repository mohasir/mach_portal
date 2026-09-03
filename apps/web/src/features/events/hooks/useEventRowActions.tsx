'use client';
import { useRouter } from 'next/navigation';
import { CheckCircle, UserPlus, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { RowActionItem } from '@/components/shared/DataTable';
import { useCancelQuote } from '@/features/quotes';
import { useMarkEventCompleted } from './useEventPayments';
import type { Event } from '../types';

interface UseEventRowActionsParams {
  onAssignStaff: (event: Event) => void;
}

export function useEventRowActions({ onAssignStaff }: UseEventRowActionsParams) {
  const { t } = useTranslation('events');
  const router = useRouter();
  const { markCompleted } = useMarkEventCompleted();
  const { cancelQuote } = useCancelQuote();

  return (event: Event): RowActionItem[] => {
    const items: RowActionItem[] = [
      { key: 'detail', onClick: () => router.push(`/admin/events/${event.id}`) },
    ];

    if (event.status === 'upcoming') {
      items.push(
        { type: 'divider' },
        {
          key: 'assignStaff',
          label: t('detail.staff.assign'),
          icon: <UserPlus size={16} />,
          guard: { [RESOURCES.EVENT]: [ACTIONS.MANAGE_STAFF_ASSIGNMENTS] },
          onClick: () => onAssignStaff(event),
        },
        {
          key: 'markCompleted',
          label: t('detail.markCompleted'),
          icon: <CheckCircle size={16} />,
          guard: { [RESOURCES.EVENT]: [ACTIONS.UPDATE] },
          onClick: () => markCompleted(event.id),
          confirm: {
            title: t('detail.markCompletedConfirm.title'),
            content: t('detail.markCompletedConfirm.content'),
            okText: t('detail.markCompletedConfirm.ok'),
          },
        },
        {
          key: 'cancel',
          label: t('detail.cancel'),
          icon: <XCircle size={16} />,
          danger: true,
          guard: { [RESOURCES.EVENT]: [ACTIONS.UPDATE] },
          onClick: () => cancelQuote(event.quoteId),
          confirm: {
            title: t('detail.cancelConfirm.title'),
            content: t('detail.cancelConfirm.content'),
            okText: t('detail.cancelConfirm.ok'),
          },
        },
      );
    }

    return items;
  };
}
