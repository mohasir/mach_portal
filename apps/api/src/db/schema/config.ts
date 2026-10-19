import {
  boolean,
  pgTable,
  primaryKey,
  integer,
  numeric,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { stateEnum } from './enums';
import { tenantId } from './tenantColumn';

export const stateSettings = pgTable(
  'state_settings',
  {
    tenantId: tenantId(),
    state: stateEnum('state').notNull(),
    taxRate: numeric('tax_rate', { mode: 'number', precision: 6, scale: 5 }).notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.state] })],
);

// One row per tenant. Business defaults that feed the quote cascade
export const appSettings = pgTable('app_settings', {
  tenantId: tenantId().primaryKey(),
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
  promptRateChanges: boolean('prompt_rate_changes').notNull().default(false),
  hideStaleQuotes: boolean('hide_stale_quotes').notNull().default(true),
  applyTaxByState: boolean('apply_tax_by_state').notNull().default(false),
  cardSurchargeRate: numeric('card_surcharge_rate', { mode: 'number', precision: 4, scale: 3 })
    .notNull()
    .default(0.09),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
