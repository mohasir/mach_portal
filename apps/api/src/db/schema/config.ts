import { boolean, pgTable, integer, numeric, text, timestamp } from 'drizzle-orm/pg-core';
import { tenantId } from './tenantColumn';
import { tenantIsolationPolicy } from '../rls/policy';

// One row per tenant. Business defaults that feed the quote cascade
export const appSettings = pgTable(
  'app_settings',
  {
    tenantId: tenantId().primaryKey(),
    depositRate: numeric('deposit_rate', { mode: 'number', precision: 4, scale: 3 })
      .notNull()
      .default(0.5),
    quoteValidityMonths: integer('quote_validity_months').notNull().default(3),
    quoteSeqStart: integer('quote_seq_start').notNull().default(1),
    currency: text('currency').notNull().default('USD'), // ISO 4217 currency code
    catalogSortable: boolean('catalog_sortable').notNull().default(true),
    optionsSelectionDeadlineDays: integer('options_selection_deadline_days').notNull().default(7),
    allowSelectOptionsAtQuote: boolean('allow_select_options_at_quote').notNull().default(true),
    hideStaleQuotes: boolean('hide_stale_quotes').notNull().default(true),
    // Rate a new product starts with; quote lines copy their product's rate, never this one.
    defaultTaxRate: numeric('default_tax_rate', { mode: 'number', precision: 6, scale: 5 })
      .notNull()
      .default(0),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  () => [tenantIsolationPolicy('app_settings')],
).enableRLS();
