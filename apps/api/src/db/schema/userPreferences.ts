import { jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { tenantId } from './tenantColumn';

// One row per user and tenant, created on first save. Shape is owned by `userPreferencesSchema` in
// @repo/schemas — kept as jsonb so adding a preference needs no schema change.
export const userPreferences = pgTable(
  'user_preferences',
  {
    tenantId: tenantId(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    preferences: jsonb('preferences').notNull().default({}),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId] })],
);
