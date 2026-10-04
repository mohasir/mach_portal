import { z } from 'zod';
import { listQuerySchema } from './pagination';
import { paymentMethodSchema } from './enums';

export const paymentsListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['paidAt', 'amount', 'createdAt']).default('paidAt'),
  dateFrom: z.iso.date().optional(),
  dateTo: z.iso.date().optional(),
  // Each list matches any of its values.
  clientIds: z.array(z.uuid()).optional(),
  eventTypeIds: z.array(z.uuid()).optional(),
  methods: z.array(paymentMethodSchema).optional(),
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
