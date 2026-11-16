'use client';
import { useFeature } from '@/lib/auth/useFeature';

export function useLineConfig() {
  return {
    priceTiersEnabled: useFeature('priceTiers'),
    configurableOptions: useFeature('configurableOptions'),
  };
}
