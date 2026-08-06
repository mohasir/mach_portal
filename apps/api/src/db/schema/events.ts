import {
  boolean,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { paymentMethodEnum, stateEnum } from './enums';
import { clients } from './clients';
import { eventTypes } from './eventTypes';
import { quotes } from './quotes';
import { staff } from './staff';
import { user } from './auth';

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id')
    .notNull()
    .unique()
    .references(() => quotes.id),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id),
  eventTypeId: uuid('event_type_id').references(() => eventTypes.id),
  eventDate: date('event_date', { mode: 'string' }),
  eventTime: text('event_time'),
  state: stateEnum('state'),
  address: text('address'),
  city: text('city'),
  totalAmount: integer('total_amount').notNull(),
  depositPaid: boolean('deposit_paid').default(false).notNull(),
  balancePaid: boolean('balance_paid').default(false).notNull(),
  paymentMethod: paymentMethodEnum('payment_method'),
  notes: text('notes'),
  completedAt: timestamp('completed_at'),
  selectionsConfirmedAt: timestamp('selections_confirmed_at'),
  selectionsConfirmedById: text('selections_confirmed_by_id').references(() => user.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const eventStaff = pgTable(
  'event_staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id),
    role: text('role'),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
  },
  (t) => [unique('event_staff_event_staff_unique').on(t.eventId, t.staffId)],
);

export const eventPayments = pgTable('event_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  method: paymentMethodEnum('method').notNull(),
  amount: integer('amount').notNull(),
  paidAt: date('paid_at', { mode: 'string' }).notNull(),
  reference: text('reference'),
  notes: text('notes'),
  createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const eventPaymentAttachments = pgTable('event_payment_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  paymentId: uuid('payment_id')
    .notNull()
    .references(() => eventPayments.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  url: text('url').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
