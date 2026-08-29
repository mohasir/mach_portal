import { pgTable, uuid, text, integer, boolean } from 'drizzle-orm/pg-core';

export const eventTypes = pgTable('event_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#1677ff'),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});
