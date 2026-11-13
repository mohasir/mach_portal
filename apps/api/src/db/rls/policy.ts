import { sql } from 'drizzle-orm';
import { pgPolicy } from 'drizzle-orm/pg-core';

export const TENANT_SETTING = 'app.tenant_id';

export const tenantPolicyName = (table: string) => `${table}_tenant_isolation`;

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
