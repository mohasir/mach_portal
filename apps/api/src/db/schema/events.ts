import {
  boolean,
  date,
  integer,
  jsonb,
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
import { rescheduleReasons } from './rescheduleReasons';
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

// Generic append-only activity log for an event — one row per notable action (staff
// assigned/removed, station selections updated, payment registered/removed, marked completed). `data` shape varies by `type` (mirrors the `notifications` table's own
// type+jsonb pattern rather than a column per action).
export const eventHistory = pgTable('event_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  data: jsonb('data').notNull(),
  changedById: text('changed_by_id').references(() => user.id, { onDelete: 'set null' }),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
});

// One row per date/time change. `from*` are nullable because the event's own date/time are.
export const eventReschedules = pgTable('event_reschedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  fromDate: date('from_date', { mode: 'string' }),
  fromTime: text('from_time'),
  toDate: date('to_date', { mode: 'string' }).notNull(),
  toTime: text('to_time'),
  reasonId: uuid('reason_id')
    .notNull()
    .references(() => rescheduleReasons.id),
  note: text('note'),
  // Staff that clashed on the new date when it was saved, kept for audit.
  staffConflicts: jsonb('staff_conflicts')
    .$type<{ staffId: string; name: string }[]>()
    .notNull()
    .default([]),
  rescheduledById: text('rescheduled_by_id').references(() => user.id, { onDelete: 'set null' }),
  rescheduledAt: timestamp('rescheduled_at').defaultNow().notNull(),
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
