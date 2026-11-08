import { describe, expect, it } from 'vitest';
import { toEffectivePermissions } from '../permissions';

describe('toEffectivePermissions', () => {
  it("shows the viewer's own grants with their scope", () => {
    expect(
      toEffectivePermissions({
        isOwner: false,
        grants: { 'quote.read': 'own', 'client.create': 'all' },
      }),
    ).toEqual({ value: { 'quote.read': 'own', 'client.create': 'all' }, locked: false });
  });

  it('drops grants that are no longer in the catalog', () => {
    expect(
      toEffectivePermissions({ isOwner: false, grants: { 'quote.read': 'all', 'gone.x': 'all' } })
        .value,
    ).toEqual({ 'quote.read': 'all' });
  });

  it('shows everything granted for an owner', () => {
    expect(toEffectivePermissions({ isOwner: true, grants: {} })).toEqual({
      value: {},
      locked: true,
    });
  });

  it('shows nothing while the permissions are loading', () => {
    expect(toEffectivePermissions(undefined)).toEqual({ value: {}, locked: false });
  });
});
