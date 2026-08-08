'use client';
import { Button, Card, Typography } from 'antd';
import { Trans, useTranslation } from 'react-i18next';
import { TbTrash } from 'react-icons/tb';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { resolveSystemIcon } from '../helpers';
import { useDismissNotification } from '../hooks/useNotifications';
import { useOpenNotification } from '../hooks/useOpenNotification';
import type { Notification } from '../types';

interface NotificationCardProps {
  item: Notification;
}

export function NotificationCard({ item }: NotificationCardProps) {
  const { t } = useTranslation('notifications');
  const { relative, date } = useDateFormatter();
  const openNotification = useOpenNotification();
  const { dismissNotification } = useDismissNotification();
  const { data } = item;
  const SystemIcon = data.source === 'system' ? resolveSystemIcon(data.icon) : null;
  // Dates in `data` are raw ISO strings (snapshotted at creation) — format them here rather
  // than baking a locale-specific format into the payload.
  const values =
    data.source === 'user'
      ? { ...data, actorName: data.actor.name }
      : 'eventDate' in data
        ? { ...data, eventDate: date(data.eventDate), deadline: date(data.deadline) }
        : data;

  return (
    <Card
      hoverable
      size="small"
      onClick={() => openNotification(item)}
      className={`relative ${item.read ? '' : 'bg-info/10'}`}
    >
      <div className="flex items-start gap-3">
        {data.source === 'user' ? (
          <AvatarUser name={data.actor.name} image={data.actor.image} showDetails={false} />
        ) : (
          SystemIcon && <SystemIcon size={20} className="text-info shrink-0" />
        )}
        <div className="min-w-0 flex-1 pr-8">
          {t(`titles.${item.type}`, { defaultValue: '' }) && (
            <Typography.Text strong className="text-blacker">
              {t(`titles.${item.type}`, { defaultValue: '' })}
            </Typography.Text>
          )}
          <Typography.Text className="text-blacker">
            <Trans
              t={t}
              i18nKey={`types.${item.type}`}
              values={values}
              components={{
                bold: <Typography.Text className="text-blacker" strong />,
                caption: <Typography.Text className="text-blacker/90 mt-0.5 block" />,
              }}
            />
          </Typography.Text>
          <Typography.Text type="secondary" className="mt-2 block text-xs">
            {relative(item.createdAt)}
          </Typography.Text>
        </div>
      </div>
      {!item.read && (
        <span className="bg-info absolute top-1/2 right-4 -translate-y-1/2 size-2 rounded-full" />
      )}
      {item.read && (
        <Button
          type="text"
          shape="square"
          size="small"
          icon={<TbTrash size={16} className="text-error" />}
          className="bg-error/10 absolute top-1/2 right-3 -translate-y-1/2 p-1"
          onClick={(e) => {
            e.stopPropagation();
            void dismissNotification(item.id);
          }}
        />
      )}
    </Card>
  );
}
