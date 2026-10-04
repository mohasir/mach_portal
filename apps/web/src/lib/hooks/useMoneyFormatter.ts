'use client';
import { useMemo } from 'react';
import { useConfig } from '@/features/settings';
import { formatMoney, getCurrencySymbol } from '@/lib/utils/money';
import { useLocaleStore } from '@/lib/stores/locale.store';

const FALLBACK_CURRENCY = 'USD';

export function useMoneyFormatter() {
  const locale = useLocaleStore((s) => s.locale);
  const { data } = useConfig();
  const currency = data?.appSettings.currency ?? FALLBACK_CURRENCY;

  return useMemo(
    () => ({
      money: (cents: number) => formatMoney(cents, locale, currency),
      currencySymbol: getCurrencySymbol(locale, currency),
    }),
    [locale, currency],
  );
}
