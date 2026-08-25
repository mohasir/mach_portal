'use client';
import { useState } from 'react';
import { App, Button, Card, Empty, Typography } from 'antd';
import { UserPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { useDeleteConfirm } from '@/components/shared/ConfirmDialogs';
import { AssignStaffModal } from '@/features/quotes/components/pipeline/AssignStaffModal';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import { useRemoveStaff } from '../../hooks/useEventStaff';
import type { EventDetail } from '../../types';

interface EventStaffPanelProps {
  event: EventDetail;
}

export function EventStaffPanel({ event }: EventStaffPanelProps) {
  const { t } = useTranslation('events');
  const { modal } = App.useApp();
  const isDesktop = useIsDesktop();
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

  const canAssign = event.status !== 'completed';

  return (
    <Card
      title={t('detail.staff.title')}
      extra={
        canAssign && (
          <Button size="small" icon={<UserPlus size={14} />} onClick={() => setAssignOpen(true)}>
            {t('detail.staff.assign')}
          </Button>
        )
      }
    >
      {event.staff.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('detail.staff.empty')} />
      ) : (
        <div className="flex flex-col">
          {event.staff.map((member, index) => (
            <div
              key={member.id}
              className={`flex items-center justify-between gap-3 py-3 ${
                index > 0 ? 'border-line border-t' : ''
              }`}
            >
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
              <Button
                type="link"
                danger
                size="small"
                icon={<X size={14} />}
                loading={isPending}
                onClick={() => onRemove(member.staffId, member.staffName)}
              >
                {t('detail.staff.remove')}
              </Button>
            </div>
          ))}
        </div>
      )}

      <AssignStaffModal
        eventId={event.id}
        eventDate={event.eventDate}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
      />
      {deleteContextHolder}
    </Card>
  );
}
