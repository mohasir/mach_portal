import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { stateEnum } from './enums';

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  city: text('city'),
  state: stateEnum('state'),
  address: text('address'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
