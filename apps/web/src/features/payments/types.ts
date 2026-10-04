import type { PaymentsListQuery } from '@repo/schemas';
import type { RouterOutputs } from '@/lib/trpc/types';

export type Payment = RouterOutputs['payments']['list']['items'][number];
export type PaymentIncome = RouterOutputs['payments']['income'];
export type PaymentIncomeItem = PaymentIncome['items'][number];

/** Filter-bar state of the payments list (search lives in the table's own query). */
export type PaymentsFilters = Pick<
  PaymentsListQuery,
  'dateFrom' | 'dateTo' | 'clientIds' | 'eventTypeIds' | 'methods'
>;
