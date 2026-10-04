import { z } from 'zod';
import { listQuerySchema } from './pagination';
import { paymentMethodSchema } from './enums';

export const paymentsListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['paidAt', 'amount', 'createdAt']).default('paidAt'),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  // Each list matches any of its values; capped so a crafted request can't build a huge IN (...).
  clientIds: z.array(z.uuid()).max(100).optional(),
  eventTypeIds: z.array(z.uuid()).max(100).optional(),
  methods: z.array(paymentMethodSchema).max(100).optional(),
});
export type PaymentsListQuery = z.infer<typeof paymentsListQuerySchema>;

export const paymentsIncomeGroupBySchema = z.enum(['week', 'month', 'year']);
export type PaymentsIncomeGroupBy = z.infer<typeof paymentsIncomeGroupBySchema>;

export const paymentsIncomeQuerySchema = z.object({
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  groupBy: paymentsIncomeGroupBySchema.default('month'),
});
export type PaymentsIncomeQuery = z.infer<typeof paymentsIncomeQuerySchema>;
