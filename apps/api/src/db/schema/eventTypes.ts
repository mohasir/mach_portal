import { pgTable, uuid, text, integer, boolean, unique } from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';

export const eventTypes = pgTable(
  'event_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    color: text('color').notNull().default('#1677ff'),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => [unique('event_types_tenant_name_unique').on(t.tenantId, t.name)],
);
