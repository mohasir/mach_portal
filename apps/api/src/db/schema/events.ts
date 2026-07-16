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
  totalAmount: integer('total_amount').notNull(),
  depositPaid: boolean('deposit_paid').default(false).notNull(),
  balancePaid: boolean('balance_paid').default(false).notNull(),
  paymentMethod: paymentMethodEnum('payment_method'),
  notes: text('notes'),
  completedAt: timestamp('completed_at'),
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
