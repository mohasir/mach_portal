import { describe, expect, it } from 'vitest';
import { historyDetailParts } from '../helpers';

describe('historyDetailParts', () => {
  it('reads the feature key of a feature event', () => {
    expect(
      historyDetailParts({ featureKey: 'quotes', before: null, after: { enabled: true } }),
    ).toEqual({
      featureKey: 'quotes',
    });
  });

  it('reads the key of a feature audit entry', () => {
    expect(historyDetailParts({ key: 'events', priceCents: 100 })).toEqual({
      featureKey: 'events',
    });
  });

  it('reads the path of an access entry', () => {
    expect(historyDetailParts({ path: 'console.features.list' })).toEqual({
      path: 'console.features.list',
    });
  });

  it('reads the catalog kind', () => {
    expect(historyDetailParts({ kind: 'services' })).toEqual({ catalogKind: 'services' });
  });

  it('is empty without detail or usable fields', () => {
    expect(historyDetailParts(null)).toEqual({});
    expect(historyDetailParts({ featureKey: 42 })).toEqual({});
  });
});
