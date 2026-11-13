import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  boolean,
  uniqueIndex,
  unique,
} from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';
import { tenantIsolationPolicy } from '../rls/policy';

export const permissionScopeEnum = pgEnum('permission_scope', ['own', 'all']);

export const role = pgTable(
  'role',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    tenantId: tenantId(),
    name: text('name').notNull(),
    isOwner: boolean('is_owner').default(false).notNull(),
    version: integer('version').default(1).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique('role_tenant_name_uq').on(t.tenantId, t.name),
    uniqueIndex('role_one_owner_per_tenant_uidx')
      .on(t.tenantId)
      .where(sql`${t.isOwner}`),
    tenantIsolationPolicy('role'),
  ],
).enableRLS();

export const rolePermission = pgTable(
  'role_permission',
  {
    roleId: text('role_id')
      .notNull()
      .references(() => role.id, { onDelete: 'cascade' }),
    tenantId: tenantId(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    scope: permissionScopeEnum('scope').default('all').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.resource, t.action] }),
    index('role_permission_tenant_idx').on(t.tenantId),
    tenantIsolationPolicy('role_permission'),
  ],
).enableRLS();

export const roleAuditLog = pgTable(
  'role_audit_log',
  {
    id: text('id')
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    tenantId: tenantId(),
    // No FK: the log must outlive the actor's account.
    actorUserId: text('actor_user_id').notNull(),
    // Set null on role delete so the history of a deleted role is kept.
    roleId: text('role_id').references(() => role.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('role_audit_log_tenant_created_idx').on(t.tenantId, t.createdAt),
    index('role_audit_log_role_idx').on(t.roleId),
    tenantIsolationPolicy('role_audit_log'),
  ],
).enableRLS();
