import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

// One row per user, created on first save. Shape is owned by `userPreferencesSchema` in
// @repo/schemas — kept as jsonb so adding a preference needs no schema change.
export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  preferences: jsonb('preferences').notNull().default({}),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
