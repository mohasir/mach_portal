import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { stateEnum } from './enums';
import { tenantId } from './tenantColumn';

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    city: text('city'),
    state: stateEnum('state'),
    address: text('address'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('clients_tenant_idx').on(t.tenantId)],
);
