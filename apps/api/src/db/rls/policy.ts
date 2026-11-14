import { sql } from 'drizzle-orm';
import { pgPolicy } from 'drizzle-orm/pg-core';

export const TENANT_SETTING = 'app.tenant_id';

// Tenant-owned tables written only by the platform role (BYPASSRLS), so they stay out of the FOR ALL
// isolation contract: tenant_features has a read-only policy and tenant_feature_events none.
export const PLATFORM_MANAGED_TABLES: readonly string[] = [
  'tenant_features',
  'tenant_feature_events',
];

export const tenantPolicyName = (table: string) => `${table}_tenant_isolation`;
export const tenantReadPolicyName = (table: string) => `${table}_tenant_read`;

// With the setting unset current_setting(..., true) yields NULL (or '' once a transaction-local
// value has ended on a reused connection), so no row matches and every insert fails: fail closed.
const sameTenant = sql.raw(`tenant_id = current_setting('${TENANT_SETTING}', true)`);

// Every tenant-owned table declares this policy and calls .enableRLS(); FORCE ROW LEVEL SECURITY
// is not emitted by drizzle-kit and is appended by hand to the migration that adds the policy.
export const tenantIsolationPolicy = (table: string) =>
  pgPolicy(tenantPolicyName(table), {
    as: 'permissive',
    for: 'all',
    to: 'public',
    using: sameTenant,
    withCheck: sameTenant,
  });

// For tables the app role may read but never write: with no INSERT/UPDATE/DELETE policy, row level
// security rejects every write by a role without BYPASSRLS, whatever its table grants.
export const tenantReadPolicy = (table: string) =>
  pgPolicy(tenantReadPolicyName(table), {
    as: 'permissive',
    for: 'select',
    to: 'public',
    using: sameTenant,
  });
