import { pgEnum } from 'drizzle-orm/pg-core';

export const stateEnum = pgEnum('state', ['NY', 'NJ', 'CT']);
export const paymentMethodEnum = pgEnum('payment_method', [
  'zelle',
  'cash',
  'card',
  'check',
  'transfer',
]);
