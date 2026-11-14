'use client';
import { isToggleable, type FeatureKey } from '@repo/guards';
import { useFeatures } from '@/features/tenant/hooks/useFeatures';

/** Whether the feature is active; non-core features read as off while loading or on error. */
export function useFeature(key: FeatureKey): boolean {
  const { keys } = useFeatures();
  return !isToggleable(key) || keys.has(key);
}
