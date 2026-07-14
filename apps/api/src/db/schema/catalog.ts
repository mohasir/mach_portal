import { pgTable, uuid, text, integer, boolean, pgEnum, unique } from 'drizzle-orm/pg-core';

export const optionGroupTypeEnum = pgEnum('option_group_type', ['select', 'included']);

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  isPremium: boolean('is_premium').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const productPriceTiers = pgTable(
  'product_price_tiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    numPersons: integer('num_persons').notNull(),
    price: integer('price').notNull(), // cents, total for numPersons
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => [unique('product_price_tiers_product_persons_unique').on(t.productId, t.numPersons)],
);

export const optionGroups = pgTable('option_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  selectionType: optionGroupTypeEnum('selection_type').default('select').notNull(),
  maxSelect: integer('max_select'),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const options = pgTable('options', {
  id: uuid('id').primaryKey().defaultRandom(),
  optionGroupId: uuid('option_group_id')
    .notNull()
    .references(() => optionGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});
