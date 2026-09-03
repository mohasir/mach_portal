'use client';
import { useState } from 'react';
import { App, Button, Empty, Input, Spin } from 'antd';
import { UserMinus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStaffAvailability } from '@/features/staff';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { useDeleteConfirm } from '@/components/shared/ConfirmDialogs';
import { IconBadge } from '@/components/shared/IconBadge';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useAssignStaff, useRemoveStaff } from '../../hooks/useEventStaff';
import type { EventDetail } from '../../types';

interface AssignStaffSheetProps {
  eventId: string | null;
  eventDate: string | null;
  /** Omitted where the caller only has the lightweight event list row (no `.staff`) — the
   * "currently assigned" group just doesn't render then. */
  assignedStaff?: EventDetail['staff'];
  open: boolean;
  onClose: () => void;
}

export function AssignStaffSheet({
  eventId,
  eventDate,
  assignedStaff = [],
  open,
  onClose,
}: AssignStaffSheetProps) {
  const { t } = useTranslation('events');
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
  const [confirmDelete, deleteContextHolder] = useDeleteConfirm();
  const [search, setSearch] = useState('');
  const { data: available, isLoading } = useStaffAvailability(
    open ? (eventDate ?? undefined) : undefined,
  );
  const { assignStaff, isPending: isAssigning } = useAssignStaff();
  const { removeStaff, isPending: isRemoving } = useRemoveStaff();

  const assignedIds = new Set(assignedStaff.map((member) => member.staffId));
  const candidates = (available ?? []).filter(
    (member) =>
      !assignedIds.has(member.id) &&
      member.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const onSelect = async (staffId: string) => {
    if (!eventId) return;
    try {
      await assignStaff({ eventId, staffId });
    } catch {
      // error notificado por useApiError
    }
  };

  const onRemove = (staffId: string, name: string) => {
    if (!eventId) return;
    const options = {
      title: t('detail.staff.removeConfirmTitle'),
      content: t('detail.staff.removeConfirmContent', { name }),
      onOk: () => removeStaff({ eventId, staffId }),
    };
    if (!isDesktop) return confirmDelete(options);
    modal.confirm({ ...options, okButtonProps: { danger: true } });
  };

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={t('assignStaff.title')}>
        <div className="flex flex-col gap-2 px-4 pb-4">
          <Input.Search
            autoFocus
            allowClear
            placeholder={t('assignStaff.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {assignedStaff.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <span className="px-1 text-xs text-gray-500">{t('assignStaff.currentLabel')}</span>
              <div className="flex flex-col gap-2">
                {assignedStaff.map((member) => (
                  <div
                    key={member.id}
                    className="bg-primary/5 flex items-center justify-between rounded-2xl py-2 px-3"
                  >
                    <AvatarUser
                      name={member.staffName}
                      extra={
                        member.role ? (
                          <span className="block truncate text-xs text-gray-500">
                            {member.role}
                          </span>
                        ) : undefined
                      }
                    />
                    <Button
                      type="text"
                      danger
                      disabled={isRemoving}
                      onClick={() => onRemove(member.staffId, member.staffName)}
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
                      aria-label={t('detail.staff.remove')}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Spin size="small" />
            </div>
          ) : candidates.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('assignStaff.empty')} />
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              <span className="px-1 text-xs text-gray-500">{t('assignStaff.otherLabel')}</span>
              <div className="bg-primary/5 flex flex-col rounded-3xl p-4">
                {candidates.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    disabled={isAssigning}
                    onClick={() => void onSelect(member.id)}
                    className="flex items-center gap-3 py-3 text-left disabled:opacity-50"
                  >
                    <AvatarUser name={member.name} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </BottomSheet>
      {deleteContextHolder}
    </>
  );
}
