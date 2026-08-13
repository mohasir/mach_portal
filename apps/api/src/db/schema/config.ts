import { boolean, pgTable, integer, numeric, text, timestamp } from 'drizzle-orm/pg-core';
import { stateEnum } from './enums';

export const stateSettings = pgTable('state_settings', {
  state: stateEnum('state').primaryKey(),
  taxRate: numeric('tax_rate', { mode: 'number', precision: 6, scale: 5 }).notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Singleton (id always 1). Business defaults that feed the quote cascade
export const appSettings = pgTable('app_settings', {
  id: integer('id').primaryKey().default(1),
  depositRate: numeric('deposit_rate', { mode: 'number', precision: 4, scale: 3 })
    .notNull()
    .default(0.5),
  quoteValidityMonths: integer('quote_validity_months').notNull().default(3),
  minPersonsPerLine: integer('min_persons_per_line').notNull().default(30),
  quoteSeqStart: integer('quote_seq_start').notNull().default(1),
  currency: text('currency').notNull().default('USD'), // ISO 4217 currency code
  catalogSortable: boolean('catalog_sortable').notNull().default(true),
  optionsSelectionDeadlineDays: integer('options_selection_deadline_days').notNull().default(7),
  allowSelectOptionsAtQuote: boolean('allow_select_options_at_quote').notNull().default(true),
  applyTaxByState: boolean('apply_tax_by_state').notNull().default(false),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
