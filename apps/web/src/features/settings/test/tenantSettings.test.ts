import { describe, expect, it } from 'vitest';
import { shouldLoadTenantSettings } from '../helpers';

describe('shouldLoadTenantSettings', () => {
  it('loads once a session exists and the active organization resolved to one', () => {
    expect(
      shouldLoadTenantSettings({ hasSession: true, tenantResolved: true, hasActiveTenant: true }),
    ).toBe(true);
  });

  it('waits while the active organization is still loading', () => {
    expect(
      shouldLoadTenantSettings({ hasSession: true, tenantResolved: false, hasActiveTenant: false }),
    ).toBe(false);
  });

  it('does not load without an active organization (platform admin, organization picker)', () => {
    expect(
      shouldLoadTenantSettings({ hasSession: true, tenantResolved: true, hasActiveTenant: false }),
    ).toBe(false);
  });

  it('does not load without a session', () => {
    expect(
      shouldLoadTenantSettings({ hasSession: false, tenantResolved: true, hasActiveTenant: true }),
    ).toBe(false);
  });
});
