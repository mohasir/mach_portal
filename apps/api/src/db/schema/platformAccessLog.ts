import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organization, user } from './auth';

// Platform-wide audit trail of platform admins acting inside tenants they do not belong to.
export const platformAccessLog = pgTable(
  'platform_access_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Restrict (no cascade): deleting a user or tenant must not silently erase audit history.
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    tenantId: text('tenant_id')
      .notNull()
      .references(() => organization.id),
    path: text('path').notNull(),
    type: text('type', { enum: ['query', 'mutation'] }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('platform_access_log_tenant_created_idx').on(t.tenantId, t.createdAt),
    // Every user delete checks the restrict FK; without this index that check scans the log.
    index('platform_access_log_user_idx').on(t.userId),
  ],
);
