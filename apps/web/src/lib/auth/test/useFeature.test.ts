import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeatureKey } from '@repo/guards';

const state = vi.hoisted(() => ({ keys: new Set<string>(), isPending: true }));

vi.mock('@/features/tenant/hooks/useFeatures', () => ({
  useFeatures: () => ({ keys: state.keys, isPending: state.isPending }),
}));

import { useFeature } from '../useFeature';

describe('useFeature', () => {
  beforeEach(() => {
    state.keys = new Set();
    state.isPending = true;
  });

  it('is always true for a core feature, even while loading', () => {
    expect(useFeature('clients')).toBe(true);
    expect(useFeature('dashboard')).toBe(true);
  });

  it('is false for a non-core feature while loading', () => {
    expect(useFeature('quotes')).toBe(false);
  });

  it('is false for a non-core feature absent from the response', () => {
    state.isPending = false;
    state.keys = new Set<FeatureKey>(['events']);
    expect(useFeature('quotes')).toBe(false);
  });

  it('is true for a non-core feature present in the response', () => {
    state.isPending = false;
    state.keys = new Set<FeatureKey>(['quotes']);
    expect(useFeature('quotes')).toBe(true);
  });
});
