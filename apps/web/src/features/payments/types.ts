import type { RouterOutputs } from '@/lib/trpc/types';

export type Payment = RouterOutputs['payments']['list']['items'][number];
export type PaymentIncome = RouterOutputs['payments']['income'];
export type PaymentIncomeItem = PaymentIncome['items'][number];
