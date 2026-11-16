import { pgTable, uuid, text, integer, boolean, pgEnum, unique, index } from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';
import { unitsOfMeasure } from './unitsOfMeasure';
import { tenantIsolationPolicy } from '../rls/policy';

export const optionGroupTypeEnum = pgEnum('option_group_type', ['select', 'included']);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    description: text('description'),
    isPremium: boolean('is_premium').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    // Per-unit price in cents; NULL leaves the product without a base price.
    price: integer('price'),
    // Unit of the price and of the quantity sold.
    uomId: uuid('uom_id')
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: 'restrict' }),
  },
  (t) => [
    unique('products_tenant_name_unique').on(t.tenantId, t.name),
    index('products_uom_idx').on(t.uomId),
    tenantIsolationPolicy('products'),
  ],
).enableRLS();

export const productPriceTiers = pgTable(
  'product_price_tiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    price: integer('price').notNull(), // cents, total for quantity
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => [
    unique('product_price_tiers_product_quantity_unique').on(t.productId, t.quantity),
    index('product_price_tiers_tenant_idx').on(t.tenantId),
    tenantIsolationPolicy('product_price_tiers'),
  ],
).enableRLS();

export const optionGroups = pgTable(
  'option_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    selectionType: optionGroupTypeEnum('selection_type').default('select').notNull(),
    maxSelect: integer('max_select'),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => [index('option_groups_tenant_idx').on(t.tenantId), tenantIsolationPolicy('option_groups')],
).enableRLS();

export const options = pgTable(
  'options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    optionGroupId: uuid('option_group_id')
      .notNull()
      .references(() => optionGroups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => [index('options_tenant_idx').on(t.tenantId), tenantIsolationPolicy('options')],
).enableRLS();
