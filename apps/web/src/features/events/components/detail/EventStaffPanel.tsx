'use client';
import { useState } from 'react';
import { App, Button, Empty, Typography } from 'antd';
import { UserMinus, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { useDeleteConfirm } from '@/components/shared/ConfirmDialogs';
import { IconBadge } from '@/components/shared/IconBadge';
import { useCan } from '@/lib/auth/useCan';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useRemoveStaff } from '../../hooks/useEventStaff';
import type { EventDetail } from '../../types';
import { AssignStaffSheet } from './AssignStaffSheet';

interface EventStaffPanelProps {
  event: EventDetail;
}

export function EventStaffPanel({ event }: EventStaffPanelProps) {
  const { t } = useTranslation('events');
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
  const can = useCan();
  const canManageStaff = can({ [RESOURCES.EVENT]: [ACTIONS.MANAGE_STAFF_ASSIGNMENTS] });
  const [confirmDelete, deleteContextHolder] = useDeleteConfirm();
  const [assignOpen, setAssignOpen] = useState(false);
  const { removeStaff, isPending } = useRemoveStaff();

  const onRemove = (staffId: string, name: string) => {
    const options = {
      title: t('detail.staff.removeConfirmTitle'),
      content: t('detail.staff.removeConfirmContent', { name }),
      onOk: () => removeStaff({ eventId: event.id, staffId }),
    };
    if (!isDesktop) return confirmDelete(options);
    modal.confirm({ ...options, okButtonProps: { danger: true } });
  };

  const canAssign = canManageStaff && event.status !== 'completed';

  return (
    <>
      <div className="flex justify-between mb-4">
        <Typography.Title className="font-heading text-lg text-brown m-0!">
          {t('detail.staff.title')}
        </Typography.Title>
        {canAssign && (
          <Button
            type="primary"
            size="small"
            icon={<UserPlus size={14} />}
            onClick={() => setAssignOpen(true)}
          >
            {t('detail.staff.assign')}
          </Button>
        )}
      </div>

      {event.staff.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('detail.staff.empty')} />
      ) : (
        <div className="flex flex-col bg-primary/5 rounded-2xl p-3">
          {event.staff.map((member) => (
            <div key={member.id} className={`flex items-center justify-between gap-3 py-3`}>
              <AvatarUser
                name={member.staffName}
                extra={
                  member.role ? (
                    <Typography.Text type="secondary" className="block truncate text-xs">
                      {member.role}
                    </Typography.Text>
                  ) : undefined
                }
              />
              {canManageStaff && (
                <Button
                  type="text"
                  danger
                  disabled={isPending}
                  loading={isPending}
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
                />
              )}
            </div>
          ))}
        </div>
      )}

      <AssignStaffSheet
        eventId={event.id}
        eventDate={event.eventDate}
        assignedStaff={event.staff}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
      />
      {deleteContextHolder}
    </>
  );
}
