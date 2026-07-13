import { pgTable, uuid, text, integer, boolean } from 'drizzle-orm/pg-core';

// Generic naming (docs/mach-bar-domain.md D15): product → "Estación", option_group →
// "Sección", option → "Ítem" (Mach Bar labels applied via i18n, not in the schema).

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  basePrice: integer('base_price').notNull(), // cents, price/person
  isPremium: boolean('is_premium').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const optionGroups = pgTable('option_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  maxSelect: integer('max_select'), // null = unlimited
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const options = pgTable('options', {
  id: uuid('id').primaryKey().defaultRandom(),
  optionGroupId: uuid('option_group_id')
    .notNull()
    .references(() => optionGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true).notNull(), // soft-delete: referenced by quote_line_options
  sortOrder: integer('sort_order').default(0).notNull(),
});
