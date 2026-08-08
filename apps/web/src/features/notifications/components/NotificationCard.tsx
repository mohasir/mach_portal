'use client';
import { Button, Card, Typography } from 'antd';
import { Trans, useTranslation } from 'react-i18next';
import { TbEyeCheck, TbTrash } from 'react-icons/tb';
import { AvatarUser } from '@/components/shared/AvatarUser';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';
import { resolveSystemIcon } from '../helpers';
import { useDismissNotification, useMarkNotificationRead } from '../hooks/useNotifications';
import { useOpenNotification } from '../hooks/useOpenNotification';
import type { Notification } from '../types';

interface NotificationCardProps {
  item: Notification;
}

export function NotificationCard({ item }: NotificationCardProps) {
  const { t } = useTranslation('notifications');
  const { relative } = useDateFormatter();
  const openNotification = useOpenNotification();
  const { dismissNotification } = useDismissNotification();
  const { markNotificationRead } = useMarkNotificationRead();
  const { data } = item;
  const SystemIcon = data.source === 'system' ? resolveSystemIcon(data.icon) : null;

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
          SystemIcon && <SystemIcon size={20} className="text-info mt-0.5 shrink-0" />
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
              values={
                data.source === 'user'
                  ? { actorName: data.actor.name, quoteNumber: data.quoteNumber }
                  : { quoteNumber: data.quoteNumber }
              }
              components={{ bold: <Typography.Text className="text-blacker" strong /> }}
            />
          </Typography.Text>
          <Typography.Text type="secondary" className="mt-1 block text-xs">
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
