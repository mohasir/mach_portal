import { describe, expect, it } from 'vitest';
import { FEATURES, FEATURE_KEYS, isFeatureKey, isToggleable, type FeatureKey } from '../registry';

describe('FEATURES', () => {
  it('only lets core features require other core features', () => {
    for (const key of FEATURE_KEYS) {
      if (FEATURES[key].kind !== 'core') continue;
      for (const dep of FEATURES[key].requires) {
        expect(FEATURES[dep].kind).toBe('core');
      }
    }
  });

  it('never points a dependency at an unknown key', () => {
    for (const key of FEATURE_KEYS) {
      for (const dep of FEATURES[key].requires) {
        expect(isFeatureKey(dep)).toBe(true);
      }
    }
  });

  it('has no dependency cycles', () => {
    const visit = (key: FeatureKey, path: readonly FeatureKey[]) => {
      expect(path).not.toContain(key);
      for (const dep of FEATURES[key].requires) visit(dep, [...path, key]);
    };
    for (const key of FEATURE_KEYS) visit(key, []);
  });

  it('makes events depend on quotes', () => {
    expect(FEATURES.events.requires).toEqual(['quotes']);
  });

  it('classifies toggleable features', () => {
    expect(isToggleable('auth')).toBe(false);
    expect(isToggleable('quotes')).toBe(true);
    expect(isToggleable('priceTiers')).toBe(true);
  });

  it('offers extra charges as an add-on of its own', () => {
    expect(FEATURES.extraCharges).toEqual({ kind: 'addon', requires: [] });
  });
});
