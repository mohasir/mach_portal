import dayjs from 'dayjs';
import { Bell, type LucideIcon } from 'lucide-react';
import type { Notification } from './types';

/** Where a notification's "detail" action navigates, keyed by its `entityType`. */
export const NOTIFICATION_ENTITY_ROUTES: Record<string, (id: string) => string> = {
  quote: (id) => `/admin/quotes/${id}`,
};

// `source: 'system'` notifications carry their own icon name in `data.icon` — the action
// picks it, not the type — so this stays a lookup by that arbitrary string, not by `type`.
// Empty until a system-generated notification type actually exists; falls back to Bell.
const SYSTEM_ICON_REGISTRY: Record<string, LucideIcon> = {};

export function resolveSystemIcon(name: string): LucideIcon {
  return SYSTEM_ICON_REGISTRY[name] ?? Bell;
}

export type NotificationGroupKey = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'older';

const GROUP_ORDER: NotificationGroupKey[] = ['today', 'yesterday', 'week', 'month', 'year', 'older'];

function bucketKey(createdAt: Notification['createdAt']): NotificationGroupKey {
  const created = dayjs(createdAt);
  const now = dayjs();
  if (created.isSame(now, 'day')) return 'today';
  if (created.isSame(now.subtract(1, 'day'), 'day')) return 'yesterday';
  if (created.isAfter(now.subtract(7, 'day'))) return 'week';
  if (created.isAfter(now.subtract(30, 'day'))) return 'month';
  if (created.isSame(now, 'year')) return 'year';
  return 'older';
}

export interface NotificationGroup {
  key: NotificationGroupKey;
  items: Notification[];
}

/** Assumes `items` arrive sorted by createdAt desc — the only order this screen requests. */
export function groupNotificationsByDate(items: Notification[]): NotificationGroup[] {
  const buckets = new Map<NotificationGroupKey, Notification[]>();
  for (const item of items) {
    const key = bucketKey(item.createdAt);
    const arr = buckets.get(key) ?? [];
    arr.push(item);
    buckets.set(key, arr);
  }
  return GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({ key, items: buckets.get(key)! }));
}
