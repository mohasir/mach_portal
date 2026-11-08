import { describe, expect, it } from 'vitest';
import {
  canSwitchTenant,
  filterOrganizations,
  resolveGateState,
  shouldAutoSelect,
} from '../helpers';

describe('canSwitchTenant', () => {
  it('is true with more than one membership or for a platform admin', () => {
    expect(canSwitchTenant({ membershipCount: 2, isPlatformAdmin: false })).toBe(true);
    expect(canSwitchTenant({ membershipCount: 0, isPlatformAdmin: true })).toBe(true);
  });

  it('is false with a single membership and no platform role', () => {
    expect(canSwitchTenant({ membershipCount: 1, isPlatformAdmin: false })).toBe(false);
    expect(canSwitchTenant({ membershipCount: 0, isPlatformAdmin: false })).toBe(false);
  });
});

describe('shouldAutoSelect', () => {
  it('returns the only membership when no organization is active', () => {
    expect(shouldAutoSelect({ memberships: [{ id: 'a' }], activeTenantId: null })).toBe('a');
  });

  it('does nothing with several memberships, none, or an active organization', () => {
    expect(
      shouldAutoSelect({ memberships: [{ id: 'a' }, { id: 'b' }], activeTenantId: null }),
    ).toBe(null);
    expect(shouldAutoSelect({ memberships: [], activeTenantId: null })).toBe(null);
    expect(shouldAutoSelect({ memberships: [{ id: 'a' }], activeTenantId: 'a' })).toBe(null);
  });
});

describe('filterOrganizations', () => {
  const items = [
    { id: '1', name: 'Mach Bar', slug: 'mach' },
    { id: '2', name: 'Café Sol', slug: 'sol-cafe' },
  ];

  it('matches name or slug, ignoring case and surrounding spaces', () => {
    expect(filterOrganizations(items, '  MACH ')).toEqual([items[0]]);
    expect(filterOrganizations(items, 'sol-')).toEqual([items[1]]);
  });

  it('returns everything for an empty query', () => {
    expect(filterOrganizations(items, ' ')).toEqual(items);
  });
});

describe('resolveGateState', () => {
  const ready = {
    tenantPending: false,
    tenantError: false,
    tenant: { id: 'a' },
    hasPermissions: true,
    permissionsError: false,
  };

  it('renders only with an organization and its permissions', () => {
    expect(resolveGateState(ready)).toBe('ready');
  });

  it('keeps loading while the organization or the permissions are on their way', () => {
    expect(resolveGateState({ ...ready, tenantPending: true, tenant: undefined })).toBe('loading');
    expect(resolveGateState({ ...ready, hasPermissions: false })).toBe('loading');
  });

  it('sends the user to pick an organization when none is active', () => {
    expect(resolveGateState({ ...ready, tenant: null, hasPermissions: false })).toBe('redirect');
  });

  it('reports which load failed', () => {
    expect(resolveGateState({ ...ready, tenantError: true })).toBe('tenantError');
    expect(resolveGateState({ ...ready, hasPermissions: false, permissionsError: true })).toBe(
      'permissionsError',
    );
  });

  it('keeps rendering with loaded permissions when a later refetch fails', () => {
    expect(resolveGateState({ ...ready, permissionsError: true })).toBe('ready');
  });
});
