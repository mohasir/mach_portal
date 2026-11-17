import { sql } from 'drizzle-orm';
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';
import { tenantIsolationPolicy } from '../rls/policy';

export const productCategories = pgTable(
  'product_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    // "Bebidas" and "bebidas" would read as the same category.
    uniqueIndex('product_categories_tenant_name_uidx').on(t.tenantId, sql`lower(${t.name})`),
    tenantIsolationPolicy('product_categories'),
  ],
).enableRLS();
