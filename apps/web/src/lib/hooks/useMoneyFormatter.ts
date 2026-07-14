'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';
import { formatMoney } from '@/lib/utils/money';
import { useLocaleStore } from '@/lib/stores/locale.store';
import type { Locale as AppLocale } from '@/lib/i18n/config';

const FALLBACK_CURRENCY = 'USD';

export function useMoneyFormatter() {
  const trpc = useTRPC();
  const locale = useLocaleStore((s) => s.locale) as AppLocale;
  const { data } = useQuery({ ...trpc.config.get.queryOptions(), staleTime: Infinity });
  const currency = data?.appSettings.currency ?? FALLBACK_CURRENCY;

  return useMemo(
    () => ({
      money: (cents: number) => formatMoney(cents, locale, currency),
    }),
    [locale, currency],
  );
}
