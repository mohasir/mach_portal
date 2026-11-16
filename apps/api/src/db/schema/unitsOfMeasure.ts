import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { UomDimension } from '@repo/schemas';
import { tenantId } from './tenantColumn';
import { tenantIsolationPolicy } from '../rls/policy';

// Listed here rather than imported from UOM_DIMENSIONS: drizzle-kit loads the schema without
// compiling workspace packages. A unit test keeps both lists equal.
export const uomDimensionEnum = pgEnum('uom_dimension', [
  'quantity',
  'time',
  'weight',
  'volume',
  'length',
] as const satisfies readonly UomDimension[]);

export const unitsOfMeasure = pgTable(
  'units_of_measure',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    pluralName: text('plural_name').notNull(),
    // Abbreviation shown next to quantities ("5 kg"); never pluralized.
    code: text('code').notNull(),
    dimension: uomDimensionEnum('dimension').notNull(),
    // Relative to the base unit of the dimension. String mode keeps every decimal.
    factor: numeric('factor', { precision: 24, scale: 10, mode: 'string' }).notNull(),
    isBase: boolean('is_base').default(false).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    unique('units_of_measure_tenant_code_unique').on(t.tenantId, t.code),
    uniqueIndex('units_of_measure_one_base_per_dimension_uidx')
      .on(t.tenantId, t.dimension)
      .where(sql`${t.isBase}`),
    check('units_of_measure_factor_check', sql`factor > 0 AND (NOT is_base OR factor = 1)`),
    tenantIsolationPolicy('units_of_measure'),
  ],
).enableRLS();
