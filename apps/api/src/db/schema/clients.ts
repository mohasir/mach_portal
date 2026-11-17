import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';
import { tenantIsolationPolicy } from '../rls/policy';

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('clients_tenant_idx').on(t.tenantId), tenantIsolationPolicy('clients')],
).enableRLS();
