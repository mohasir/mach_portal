import { describe, expect, it } from 'vitest';
import { featureToggleState, liveDependentsOf } from '../helpers';

const NOW = Date.parse('2027-01-10T00:00:00.000Z');
const row = (key: string, enabled: boolean, expiresAt: string | null) => ({
  key,
  enabled,
  expiresAt,
});

describe('liveDependentsOf', () => {
  it('counts an enabled dependent even when its requirement has lapsed', () => {
    const features = [
      row('quotes', true, '2027-01-01T00:00:00.000Z'),
      row('events', true, null),
    ] as never;
    const dependents = liveDependentsOf('quotes', features, NOW);
    expect(dependents).toEqual(['events']);
    const state = featureToggleState('quotes', new Set(), dependents);
    expect(state.canDisable).toBe(false);
    expect(state.blockedBy).toEqual(['events']);
  });

  it('ignores disabled and expired dependents', () => {
    const features = [
      row('events', false, null),
      row('notifications', true, '2027-01-01T00:00:00.000Z'),
    ] as never;
    expect(liveDependentsOf('quotes', features, NOW)).toEqual([]);
  });
});
