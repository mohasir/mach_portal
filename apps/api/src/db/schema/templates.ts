import { pgTable, uuid, text, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';

export const templates = pgTable(
  'templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    type: text('type').notNull(),
    locale: text('locale').notNull().default('es'),
    content: jsonb('content').notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [unique('templates_tenant_type_locale_unique').on(t.tenantId, t.type, t.locale)],
);
