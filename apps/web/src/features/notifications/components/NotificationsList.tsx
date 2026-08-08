'use client';
import { useEffect, useRef } from 'react';
import { Empty, Flex, Skeleton, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { groupNotificationsByDate } from '../helpers';
import { useNotificationsFeed } from '../hooks/useNotifications';
import { NotificationCard } from './NotificationCard';

export function NotificationsList() {
  const { t } = useTranslation('notifications');
  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useNotificationsFeed();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage]);

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const groups = groupNotificationsByDate(items);

  if (groups.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('empty')} className="my-8" />;
  }

  return (
    <Flex vertical gap={24}>
      {groups.map((group) => (
        <div key={group.key}>
          <div className="px-2">
            <Typography.Text strong className="font-heading text-brown mb-2 block text-sm">
              {t(`groups.${group.key}`)}
            </Typography.Text>
          </div>
          <Flex vertical gap={8}>
            {group.items.map((item) => (
              <NotificationCard key={item.id} item={item} />
            ))}
          </Flex>
        </div>
      ))}

      {hasNextPage && (
        <div ref={sentinelRef}>
          {isFetchingNextPage && <Skeleton active paragraph={{ rows: 2 }} />}
        </div>
      )}
    </Flex>
  );
}
