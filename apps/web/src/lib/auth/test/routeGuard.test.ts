import { describe, expect, it } from 'vitest';
import { ACTIONS, RESOURCES, type PermissionCheck } from '@repo/guards';
import { DEFAULT_REDIRECT_HOME, DENIED_ROUTE, WELCOME_ROUTE } from '../navigation';
import { resolveRouteAccess } from '../route-access';
import { resolveGuardOutcome } from '../routeGuardOutcome';

const denyAll = () => false;
const allowAll = () => true;

describe('resolveGuardOutcome', () => {
  it('redirects a guarded route without permission to the denied screen', () => {
    expect(
      resolveGuardOutcome({ pathname: '/admin/events', can: denyAll, ready: true }),
    ).toEqual({ redirect: DENIED_ROUTE });
  });

  it('redirects home without permission to the welcome screen', () => {
    expect(
      resolveGuardOutcome({ pathname: DEFAULT_REDIRECT_HOME, can: denyAll, ready: true }),
    ).toEqual({ redirect: WELCOME_ROUTE });
  });

  it('allows a guarded route with permission', () => {
    const can = (check: PermissionCheck) => !!check[RESOURCES.EVENT]?.includes(ACTIONS.READ);
    expect(resolveGuardOutcome({ pathname: '/admin/events', can, ready: true })).toBe('allow');
  });

  it('allows a route with no guard', () => {
    expect(resolveGuardOutcome({ pathname: '/somewhere', can: denyAll, ready: true })).toBe('allow');
  });

  it('waits instead of redirecting while permissions are not ready', () => {
    expect(resolveGuardOutcome({ pathname: '/admin/events', can: denyAll, ready: false })).toBe(
      'wait',
    );
    expect(resolveGuardOutcome({ pathname: '/admin/events', can: allowAll, ready: false })).toBe(
      'wait',
    );
  });

  it('never redirects the denied and welcome screens', () => {
    expect(resolveRouteAccess(DENIED_ROUTE)).not.toBeTruthy();
    expect(resolveRouteAccess(WELCOME_ROUTE)).not.toBeTruthy();
    for (const pathname of [DENIED_ROUTE, WELCOME_ROUTE]) {
      expect(resolveGuardOutcome({ pathname, can: denyAll, ready: true })).toBe('allow');
    }
  });
});
