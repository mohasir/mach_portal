'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUsersList } from '@/features/users';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { WrapperAssign } from '@/components/shared/WrapperAssign';
import { useAssignQuote } from '../../hooks/useQuotes';

interface AssignQuoteSheetProps {
  quoteId: string;
  assignedToId?: string | null;
  assignedToName?: string | null;
  open: boolean;
  onClose: () => void;
}

export function AssignQuoteSheet({
  quoteId,
  assignedToId,
  assignedToName,
  open,
  onClose,
}: AssignQuoteSheetProps) {
  const { t } = useTranslation('quotes');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useUsersList({
    search: search || undefined,
    sortBy: 'name',
    sortDir: 'asc',
  });
  const { assignQuote, isPending } = useAssignQuote();

  const users = (data?.items ?? []).filter((u) => !u.banned && u.id !== assignedToId);

  const onSelect = async (userId: string) => {
    try {
      await assignQuote({ id: quoteId, assignedToId: userId });
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  const onRemove = async () => {
    try {
      await assignQuote({ id: quoteId, assignedToId: null });
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('pipeline.assignQuote.title')}>
      <WrapperAssign
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('pipeline.assignQuote.userPlaceholder')}
        assignedLabel={t('pipeline.assignQuote.currentLabel')}
        assignedItems={assignedToName ? [{ id: assignedToId, name: assignedToName }] : []}
        assignedItemKey={(item) => item.id ?? 'current'}
        renderAssignedItem={(item) => <AvatarUser name={item.name} />}
        onRemoveAssigned={() => void onRemove()}
        removeDisabled={isPending}
        removeAriaLabel={t('pipeline.assignQuote.remove')}
        isLoading={isLoading}
        items={users}
        itemKey={(user) => user.id}
        renderItem={(user) => <AvatarUser name={user.name} />}
        onSelectItem={(user) => void onSelect(user.id)}
        itemDisabled={isPending}
        otherLabel={t('pipeline.assignQuote.otherLabel')}
        emptyDescription={t('pipeline.assignQuote.empty')}
      />
    </BottomSheet>
  );
}
