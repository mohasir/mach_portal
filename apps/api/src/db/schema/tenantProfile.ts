import type { CatalogKind } from '@repo/schemas';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organization } from './auth';
import { tenantReadPolicy } from '../rls/policy';

// Settings of an organization that only the platform role writes (see PLATFORM_MANAGED_TABLES);
// the app role reads its own row. A missing row means the defaults apply.
export const tenantProfile = pgTable(
  'tenant_profile',
  {
    tenantId: text('tenant_id')
      .primaryKey()
      .references(() => organization.id),
    catalogKind: text('catalog_kind').$type<CatalogKind>().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  () => [tenantReadPolicy('tenant_profile')],
).enableRLS();
