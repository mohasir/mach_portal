'use client';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  useMarkAllNotificationsRead,
  useUnreadNotificationsCount,
} from '../hooks/useNotifications';
import { NotificationsList } from './NotificationsList';

export function NotificationsCenterPage() {
  const { t } = useTranslation('notifications');
  const { data: unreadCount = 0 } = useUnreadNotificationsCount();
  const { markAllNotificationsRead } = useMarkAllNotificationsRead();

  const hasMoreThanNine = unreadCount > 9;

  return (
    <div className="relative">
      <PageHeader
        title={t('title')}
        onBack
        titleSuffix={
          unreadCount > 0 ? (
            <span
              className="bg-info inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 font-semibold text-ivory leading-0"
              style={{
                fontSize: hasMoreThanNine ? '8px' : '9px',
              }}
            >
              {hasMoreThanNine ? '9+' : unreadCount}
            </span>
          ) : undefined
        }
      />
      {unreadCount > 0 && (
        <div className="flex justify-end mb-2">
          <Button
            type="link"
            size="small"
            className="text-brown underline"
            onClick={() => void markAllNotificationsRead()}
          >
            {t('markAllRead')}
          </Button>
        </div>
      )}
      <NotificationsList />
    </div>
  );
}
