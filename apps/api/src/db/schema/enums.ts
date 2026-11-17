import { pgEnum } from 'drizzle-orm/pg-core';

export const paymentMethodEnum = pgEnum('payment_method', [
  'zelle',
  'cash',
  'card',
  'check',
  'transfer',
]);
