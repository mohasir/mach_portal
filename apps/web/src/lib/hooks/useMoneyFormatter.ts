'use client';
import { useMemo } from 'react';
import { formatMoney } from '@/lib/money';
import { useLocaleStore } from '@/lib/stores/locale.store';
import type { Locale as AppLocale } from '@/lib/i18n/config';

export function useMoneyFormatter() {
  const locale = useLocaleStore((s) => s.locale) as AppLocale;

  return useMemo(
    () => ({
      money: (cents: number) => formatMoney(cents, locale),
    }),
    [locale],
  );
}
