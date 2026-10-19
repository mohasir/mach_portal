import { index, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { tenantId } from './tenantColumn';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    type: text('type').notNull(),
    data: jsonb('data').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    excludedUserId: text('excluded_user_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('notifications_tenant_idx').on(t.tenantId)],
);

export const notificationReads = pgTable(
  'notification_reads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    notificationId: uuid('notification_id')
      .notNull()
      .references(() => notifications.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at').defaultNow().notNull(),
    dismissedAt: timestamp('dismissed_at'),
  },
  (t) => [
    unique('notification_reads_notification_user_unique').on(t.notificationId, t.userId),
    index('notification_reads_tenant_idx').on(t.tenantId),
  ],
);
