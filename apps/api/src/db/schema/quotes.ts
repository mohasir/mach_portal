import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  date,
  pgEnum,
  timestamp,
} from 'drizzle-orm/pg-core';
import { stateEnum } from './enums';
import { clients } from './clients';
import { eventTypes } from './eventTypes';
import { products, optionGroups, options } from './catalog';
import { user } from './auth';

export const discountTypeEnum = pgEnum('discount_type', ['fixed', 'percent']);

export const quoteStages = pgTable('quote_stages', {
  id: integer('id').primaryKey(),
  label: text('label').notNull(),
  color: text('color').notNull(), // hex, e.g. '#faad14' — picked via ColorPicker
  description: text('description'),
  sortOrder: integer('sort_order').notNull(),
});

export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  seq: integer('seq').notNull().unique(),
  number: text('number').notNull().unique(), // 'QUOYYYYMMDD-NNNNNN'
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),
  eventTypeId: uuid('event_type_id').references(() => eventTypes.id),
  eventDate: date('event_date', { mode: 'string' }),
  eventTime: text('event_time'),
  state: stateEnum('state'),
  address: text('address'),
  notes: text('notes'),
  subtotal: integer('subtotal').notNull().default(0),
  discountType: discountTypeEnum('discount_type'),
  discountValue: numeric('discount_value', { mode: 'number', precision: 10, scale: 5 }),
  discountAmount: integer('discount_amount').notNull().default(0),
  taxRate: numeric('tax_rate', { mode: 'number', precision: 6, scale: 5 }).notNull(),
  taxAmount: integer('tax_amount').notNull().default(0),
  total: integer('total').notNull().default(0),
  depositRate: numeric('deposit_rate', { mode: 'number', precision: 4, scale: 3 })
    .notNull()
    .default(0.5),
  depositAmount: integer('deposit_amount').notNull().default(0),
  stageId: integer('stage_id')
    .notNull()
    .default(1) // QUOTE_STAGE.PENDING
    .references(() => quoteStages.id),
  validUntil: date('valid_until', { mode: 'string' }),
  createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const quoteLines = pgTable('quote_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  numPersons: integer('num_persons').notNull(),
  subtotal: integer('subtotal').notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

export const quoteLineOptions = pgTable('quote_line_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteLineId: uuid('quote_line_id')
    .notNull()
    .references(() => quoteLines.id, { onDelete: 'cascade' }),
  optionId: uuid('option_id')
    .notNull()
    .references(() => options.id),
  optionGroupId: uuid('option_group_id')
    .notNull()
    .references(() => optionGroups.id),
});

export const quoteStageHistory = pgTable('quote_stage_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  fromStageId: integer('from_stage_id').references(() => quoteStages.id),
  toStageId: integer('to_stage_id')
    .notNull()
    .references(() => quoteStages.id),
  changedById: text('changed_by_id').references(() => user.id, { onDelete: 'set null' }),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
});
