import { boolean, integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';

// `requiresNote` flags reasons that force a free-text note ("Other"), instead of matching by name.
// Soft-deleted via `isActive`: past reschedules keep referencing the reason.
export const rescheduleReasons = pgTable(
  'reschedule_reasons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    requiresNote: boolean('requires_note').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => [unique('reschedule_reasons_tenant_name_unique').on(t.tenantId, t.name)],
);
