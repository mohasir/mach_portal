import { boolean, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

// `requiresNote` flags reasons that force a free-text note ("Other"), instead of matching by name.
// Soft-deleted via `isActive`: past reschedules keep referencing the reason.
export const rescheduleReasons = pgTable('reschedule_reasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  requiresNote: boolean('requires_note').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});
