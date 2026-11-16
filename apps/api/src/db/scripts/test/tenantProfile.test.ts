import { describe, expect, it } from 'vitest';
import { TenantProfileUsageError, parseCatalogKindArgs } from '../tenantProfile';

describe('parseCatalogKindArgs', () => {
  it('reads --tenant and --kind as separate tokens or with =', () => {
    expect(parseCatalogKindArgs(['--tenant', 'acme', '--kind', 'services'])).toEqual({
      tenantSlug: 'acme',
      kind: 'services',
    });
    expect(parseCatalogKindArgs(['--', '--tenant=acme', '--kind=products'])).toEqual({
      tenantSlug: 'acme',
      kind: 'products',
    });
  });

  it.each([
    [['--kind', 'services'], /--tenant/],
    [['--tenant', 'acme'], /--kind/],
    [['--tenant', 'acme', '--kind'], /needs a value/],
    [['--tenant', 'acme', '--kind', 'services', '--kind', 'products'], /more than once/],
    [['--tenant', 'acme', '--kind', 'services', '--price', '1'], /Unknown flag/],
    [['acme'], /Unexpected argument/],
  ])('rejects %j', (argv, message) => {
    expect(() => parseCatalogKindArgs(argv)).toThrow(TenantProfileUsageError);
    expect(() => parseCatalogKindArgs(argv)).toThrow(message);
  });

  // The kind itself is validated against the registry by setCatalogKind, not here.
  it('passes an unknown kind through', () => {
    expect(parseCatalogKindArgs(['--tenant', 'acme', '--kind', 'nope']).kind).toBe('nope');
  });
});
