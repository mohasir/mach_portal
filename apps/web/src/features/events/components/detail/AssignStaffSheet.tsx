'use client';
import { useState } from 'react';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { useStaffAvailability } from '@/features/staff';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { BottomSheet } from '@/components/shared/BottomSheet';
import { useDeleteConfirm } from '@/components/shared/ConfirmDialogs';
import { WrapperAssign } from '@/components/shared/WrapperAssign';
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
        <WrapperAssign
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('assignStaff.searchPlaceholder')}
          assignedLabel={t('assignStaff.currentLabel')}
          assignedItems={assignedStaff}
          assignedItemKey={(member) => member.id}
          renderAssignedItem={(member) => (
            <AvatarUser
              name={member.staffName}
              extra={
                member.role ? (
                  <span className="block truncate text-xs text-gray-500">{member.role}</span>
                ) : undefined
              }
            />
          )}
          onRemoveAssigned={(member) => onRemove(member.staffId, member.staffName)}
          removeDisabled={isRemoving}
          removeAriaLabel={t('detail.staff.remove')}
          isLoading={isLoading}
          items={candidates}
          itemKey={(member) => member.id}
          renderItem={(member) => <AvatarUser name={member.name} />}
          onSelectItem={(member) => void onSelect(member.id)}
          itemDisabled={isAssigning}
          otherLabel={t('assignStaff.otherLabel')}
          emptyDescription={t('assignStaff.empty')}
        />
      </BottomSheet>
      {deleteContextHolder}
    </>
  );
}
