import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';
import { quotes } from './quotes';
import { tenantIsolationPolicy } from '../rls/policy';

export const chargeKindEnum = pgEnum('charge_kind', ['fixed', 'percent']);

// A value is integer cents for a fixed charge and a rate (5 decimals) for a percent one.
const chargeValue = (name: string) =>
  numeric(name, { mode: 'number', precision: 14, scale: 5 }).notNull();

const valueFitsKind = (kind: string, value: string) =>
  sql.raw(
    `(${kind} = 'percent' AND ${value} >= 0 AND ${value} <= 1) OR (${kind} = 'fixed' AND ${value} >= 0 AND ${value} = trunc(${value}))`,
  );

export const chargeTypes = pgTable(
  'charge_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text('name').notNull(),
    kind: chargeKindEnum('kind').notNull(),
    defaultValue: chargeValue('default_value'),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('charge_types_tenant_name_uidx').on(t.tenantId, sql`lower(${t.name})`),
    check('charge_types_default_value_check', valueFitsKind('kind', 'default_value')),
    tenantIsolationPolicy('charge_types'),
  ],
).enableRLS();

// Name, kind and value are copied when the charge is applied, so editing or deactivating the type
// never changes a saved quote.
export const quoteCharges = pgTable(
  'quote_charges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantId(),
    quoteId: uuid('quote_id')
      .notNull()
      .references(() => quotes.id, { onDelete: 'cascade' }),
    chargeTypeId: uuid('charge_type_id').references(() => chargeTypes.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    kind: chargeKindEnum('kind').notNull(),
    value: chargeValue('value'),
    amount: integer('amount').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
  },
  (t) => [
    index('quote_charges_tenant_quote_idx').on(t.tenantId, t.quoteId),
    index('quote_charges_charge_type_idx').on(t.chargeTypeId),
    check('quote_charges_value_check', valueFitsKind('kind', 'value')),
    tenantIsolationPolicy('quote_charges'),
  ],
).enableRLS();
