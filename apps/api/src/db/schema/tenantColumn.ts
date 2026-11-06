import { text } from 'drizzle-orm/pg-core';
import { organization } from './auth';

export const tenantId = () =>
  text('tenant_id')
    .notNull()
    .references(() => organization.id);

// Tables that are not owned by a tenant: identity/org tables managed by Better Auth, the
// platform-wide access audit log, and the fixed quote pipeline catalog shared by all tenants
// (per-tenant overrides live in quote_stage_settings, which is tenant-scoped).
export const TENANT_EXEMPT_TABLES: readonly string[] = [
  'user',
  'session',
  'account',
  'verification',
  'organization',
  'member',
  'invitation',
  'quote_stages',
  'platform_access_log',
];
