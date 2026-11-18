import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organization, user } from './auth';

export const PLATFORM_AUDIT_ACTIONS = [
  'organization.create',
  'organization.view',
  'feature.set',
  'feature.unset',
  'catalog.set',
] as const;
export type PlatformAuditAction = (typeof PLATFORM_AUDIT_ACTIONS)[number];

// RLS enabled with no policy: invisible to the app role, readable and writable by platform only.
// It has no tenant isolation policy because tenant_id is optional (organization-level actions have
// none) and no tenant ever reads it.
export const platformAuditLog = pgTable(
  'platform_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Restrict (no cascade): deleting a user or tenant must not silently erase audit history.
    userId: text('user_id')
      .notNull()
      .references(() => user.id),
    action: text('action', { enum: PLATFORM_AUDIT_ACTIONS }).notNull(),
    tenantId: text('tenant_id').references(() => organization.id),
    payload: jsonb('payload'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('platform_audit_log_tenant_created_idx').on(t.tenantId, t.createdAt),
    // Every user delete checks the restrict FK; without this index that check scans the log.
    index('platform_audit_log_user_idx').on(t.userId),
    index('platform_audit_log_created_idx').on(t.createdAt),
  ],
).enableRLS();
