import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  pgEnum,
  unique,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';
import { productCategories } from './productCategories';
import { unitsOfMeasure } from './unitsOfMeasure';
import { tenantIsolationPolicy } from '../rls/policy';

export const optionGroupTypeEnum = pgEnum('option_group_type', ['select', 'included']);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    shortDescription: text('short_description'),
    longDescription: text('long_description'),
    isPremium: boolean('is_premium').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    // Per-unit price in cents; NULL leaves the product without a base price.
    price: integer('price'),
    // Unit of the price and of the quantity sold.
    uomId: uuid('uom_id')
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id').references(() => productCategories.id, {
      onDelete: 'restrict',
    }),
    sku: text('sku'),
    // Internal cost in cents; only callers with the product_cost permission see or write it.
    cost: integer('cost'),
    // Smallest quantity of a quote line, in the product's unit.
    minQuantity: integer('min_quantity').default(1).notNull(),
  },
  (t) => [
    unique('products_tenant_name_unique').on(t.tenantId, t.name),
    // "ab-1" and "AB-1" would read as the same SKU; products without one do not collide.
    uniqueIndex('products_tenant_sku_uidx')
      .on(t.tenantId, sql`lower(${t.sku})`)
      .where(sql`${t.sku} IS NOT NULL`),
    index('products_uom_idx').on(t.uomId),
    index('products_category_idx').on(t.categoryId),
    check('products_min_quantity_check', sql`min_quantity >= 1`),
    check('products_cost_check', sql`cost >= 0`),
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
