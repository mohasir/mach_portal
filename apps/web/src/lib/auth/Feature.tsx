'use client';
import type { ReactNode } from 'react';
import type { FeatureKey } from '@repo/guards';
import { useFeature } from '@/lib/auth/useFeature';

interface FeatureProps {
  name: FeatureKey;
  fallback?: ReactNode;
  children: ReactNode;
}

/** Renders `children` only when the feature is active; otherwise `fallback`. */
export function Feature({ name, fallback = null, children }: FeatureProps) {
  return <>{useFeature(name) ? children : fallback}</>;
}
