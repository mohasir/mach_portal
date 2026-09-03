'use client';
import { useState } from 'react';
import { Button, Empty, Input, Spin } from 'antd';
import { UserMinus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useUsersList } from '@/features/users';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { IconBadge } from '@/components/shared/IconBadge';
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
      <div className="flex flex-col gap-2 px-4 pb-4">
        <Input.Search
          autoFocus
          allowClear
          placeholder={t('pipeline.assignQuote.userPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {assignedToName && (
          <div className="flex flex-col gap-2 mt-4">
            <span className="text-xs text-gray-500 px-1">
              {t('pipeline.assignQuote.currentLabel')}
            </span>
            <div className="bg-primary/5 flex items-center justify-between rounded-2xl py-2 px-3">
              <AvatarUser name={assignedToName} />
              <Button
                type="text"
                danger
                disabled={isPending}
                onClick={() => void onRemove()}
                icon={
                  <IconBadge
                    icon={UserMinus}
                    shape="square"
                    badgeSize="sm"
                    size={14}
                    rounded="rounded-lg"
                    className="bg-salmon/20 text-error"
                  />
                }
                aria-label={t('pipeline.assignQuote.remove')}
              />
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spin size="small" />
          </div>
        ) : users.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('pipeline.assignQuote.empty')}
          />
        ) : (
          <div className="flex flex-col gap-2 mt-4">
            <span className="text-xs text-gray-500 px-1">
              {t('pipeline.assignQuote.otherLabel')}
            </span>
            <div className="flex flex-col bg-primary/5 rounded-3xl p-4">
              {users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => void onSelect(user.id)}
                  className="flex items-center gap-3 py-3 text-left disabled:opacity-50"
                >
                  <AvatarUser name={user.name} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
