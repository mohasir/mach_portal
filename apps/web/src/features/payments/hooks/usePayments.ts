'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { PaymentsIncomeQuery, PaymentsListQuery } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';

export function usePaymentsList(query: PaymentsListQuery) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.payments.list.queryOptions(query), placeholderData: keepPreviousData });
}

export function usePaymentsIncome(query: PaymentsIncomeQuery) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.payments.income.queryOptions(query),
    placeholderData: keepPreviousData,
  });
}
