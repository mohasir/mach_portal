import { pgTable, uuid, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('staff_tenant_idx').on(t.tenantId)],
);
