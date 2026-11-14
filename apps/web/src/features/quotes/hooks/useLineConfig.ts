'use client';
import { useConfig } from '@/features/settings';
import { useFeature } from '@/lib/auth/useFeature';

export function useLineConfig() {
  const { data } = useConfig();
  return {
    priceTiersEnabled: useFeature('priceTiers'),
    configurableOptions: useFeature('configurableOptions'),
    minPersons: data?.appSettings.minPersonsPerLine ?? 1,
  };
}
