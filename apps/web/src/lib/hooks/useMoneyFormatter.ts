'use client';
import { useMemo } from 'react';
import { useConfig } from '@/features/settings';
import { formatMoney } from '@/lib/utils/money';
import { useLocaleStore } from '@/lib/stores/locale.store';
import type { Locale as AppLocale } from '@/lib/i18n/config';

const FALLBACK_CURRENCY = 'USD';

export function useMoneyFormatter() {
  const locale = useLocaleStore((s) => s.locale) as AppLocale;
  const { data } = useConfig();
  const currency = data?.appSettings.currency ?? FALLBACK_CURRENCY;

  return useMemo(
    () => ({
      money: (cents: number) => formatMoney(cents, locale, currency),
    }),
    [locale, currency],
  );
}
