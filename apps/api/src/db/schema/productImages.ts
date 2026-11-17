import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';
import { products } from './catalog';
import { tenantId } from './tenantColumn';
import { tenantIsolationPolicy } from '../rls/policy';

// The files live in object storage; a row only keeps their keys (for deletes) and public URLs.
export const productImages = pgTable(
  'product_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    imageKey: text('image_key').notNull(),
    imageUrl: text('image_url').notNull(),
    thumbKey: text('thumb_key').notNull(),
    thumbUrl: text('thumb_url').notNull(),
    fileName: text('file_name').notNull(),
    // Of the processed image, not of the uploaded file.
    size: integer('size').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isFeatured: boolean('is_featured').default(false).notNull(),
    createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('product_images_tenant_idx').on(t.tenantId),
    index('product_images_product_idx').on(t.productId),
    uniqueIndex('product_images_one_featured_uidx')
      .on(t.productId)
      .where(sql`${t.isFeatured}`),
    tenantIsolationPolicy('product_images'),
  ],
).enableRLS();
