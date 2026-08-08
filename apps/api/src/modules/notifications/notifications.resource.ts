import { ROLES, type RoleType } from '@repo/guards';
import { notifications } from '../../db/schema';

export type NotificationType = 'quote_confirmed' | 'quote_cancelled';

// Audience per type, resolved in code rather than a DB column — a single source of truth,
// easy to extend when a new type needs a different audience. Superadmin is deliberately
// excluded here even though it bypasses every permission check elsewhere in the app.
export const NOTIFICATION_TYPE_ROLES: Record<NotificationType, RoleType[]> = {
  quote_confirmed: [ROLES.ADMIN],
  quote_cancelled: [ROLES.ADMIN],
};

export type NotificationActor = { name: string; image: string | null };

// Who/what triggered the notification, self-described in `data` rather than derived from
// `type` — the front decides avatar vs. icon per-notification from this, not from a
// type→visual lookup table (a future cron-driven type would carry `source: 'system'`).
export type NotificationVisualData =
  | { source: 'user'; actor: NotificationActor }
  | { source: 'system'; icon: string };

export type QuoteStageChangeData = { quoteNumber: string } & NotificationVisualData;

export const publicNotificationColumns = {
  id: notifications.id,
  type: notifications.type,
  data: notifications.data,
  entityType: notifications.entityType,
  entityId: notifications.entityId,
  excludedUserId: notifications.excludedUserId,
  createdAt: notifications.createdAt,
} as const;

export type PublicNotification = Pick<
  typeof notifications.$inferSelect,
  keyof typeof publicNotificationColumns
>;

export const notificationResource = (row: PublicNotification & { read: boolean }) => ({
  id: row.id,
  type: row.type as NotificationType,
  data: row.data as QuoteStageChangeData,
  entityType: row.entityType,
  entityId: row.entityId,
  createdAt: row.createdAt,
  read: row.read,
});

export const notificationCollectionResource = (rows: (PublicNotification & { read: boolean })[]) =>
  rows.map(notificationResource);

export type NotificationResource = ReturnType<typeof notificationResource>;
