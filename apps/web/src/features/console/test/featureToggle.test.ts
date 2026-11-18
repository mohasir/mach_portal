import { describe, expect, it } from 'vitest';
import type { FeatureKey } from '@repo/guards';
import { featureToggleState } from '../helpers';

const active = (...keys: FeatureKey[]) => new Set<FeatureKey>(keys);

describe('featureToggleState', () => {
  it('cannot enable events while quotes is inactive and names quotes', () => {
    const state = featureToggleState('events', active(), []);
    expect(state.canEnable).toBe(false);
    expect(state.missing).toEqual(['quotes']);
  });

  it('can enable events when quotes is active', () => {
    const state = featureToggleState('events', active('quotes'), []);
    expect(state.canEnable).toBe(true);
    expect(state.missing).toEqual([]);
  });

  it('cannot disable quotes while events is active and names events', () => {
    const state = featureToggleState('quotes', active('quotes', 'events'), ['events']);
    expect(state.canDisable).toBe(false);
    expect(state.blockedBy).toEqual(['events']);
  });

  it('can disable a feature with no active dependents', () => {
    const state = featureToggleState('priceTiers', active('priceTiers'), []);
    expect(state.canDisable).toBe(true);
    expect(state.blockedBy).toEqual([]);
  });
});
