'use client';
import { useRouter } from 'next/navigation';
import { NOTIFICATION_ENTITY_ROUTES } from '../helpers';
import { useMarkNotificationRead } from './useNotifications';
import type { Notification } from '../types';

/** Marks a notification read and navigates to whatever it points at (popover + feed share this). */
export function useOpenNotification() {
  const router = useRouter();
  const { markNotificationRead } = useMarkNotificationRead();

  return (item: Notification) => {
    void markNotificationRead(item.id);
    const buildHref = NOTIFICATION_ENTITY_ROUTES[item.entityType];
    if (buildHref) router.push(buildHref(item.entityId));
  };
}
