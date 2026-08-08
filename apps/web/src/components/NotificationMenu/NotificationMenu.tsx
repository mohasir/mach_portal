'use client';
import { useState } from 'react';
import { Badge, Button, Empty, Popover, Skeleton, Typography } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { TbBell, TbBellRinging } from 'react-icons/tb';
import type { NotificationsListQuery } from '@repo/schemas';
import { IconBadge } from '@/components/shared/IconBadge';
import {
  NotificationCard,
  useMarkAllNotificationsRead,
  useNotificationsList,
  useUnreadNotificationsCount,
} from '@/features/notifications';

const POPOVER_QUERY: NotificationsListQuery = {
  unreadOnly: true,
  pageSize: 8,
  sortBy: 'createdAt',
  sortDir: 'desc',
};

export function NotificationMenu() {
  const pathname = usePathname();
  const { t } = useTranslation('notifications');
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useNotificationsList(POPOVER_QUERY);
  const items = data?.items;
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const { markAllNotificationsRead } = useMarkAllNotificationsRead();

  const onViewAll = () => {
    setOpen(false);
    router.push('/admin/notifications');
  };

  const content = (
    <div className="w-72">
      <Typography.Text strong className="text-brown">
        {t('title')}
      </Typography.Text>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} className="mt-3" />
      ) : !items || items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('empty')} className="my-4" />
      ) : (
        <div className="mt-3 flex max-h-80 flex-col gap-1 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} onClick={() => setOpen(false)}>
              <NotificationCard item={item} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 py-1 flex items-center gap-2">
        {unreadCount > 0 && (
          <Button
            type="link"
            size="small"
            className="px-0 font-normal text-blacker underline"
            onClick={() => void markAllNotificationsRead()}
          >
            {t('markAllRead')}
          </Button>
        )}
        <Button type="primary" size="small" className="ml-auto" onClick={onViewAll}>
          {t('viewAll')}
        </Button>
      </div>
    </div>
  );

  if (pathname === '/admin/notifications') return null;

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
    >
      <Badge dot={unreadCount > 0} offset={[-10, 10]}>
        <Button
          type="text"
          shape="circle"
          icon={<IconBadge icon={unreadCount > 0 ? TbBellRinging : TbBell} size={18} />}
        />
      </Badge>
    </Popover>
  );
}
