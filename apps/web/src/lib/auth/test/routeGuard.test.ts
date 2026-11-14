import { describe, expect, it } from 'vitest';
import { ACTIONS, RESOURCES, type PermissionCheck } from '@repo/guards';
import { DEFAULT_REDIRECT_HOME, DENIED_ROUTE, WELCOME_ROUTE } from '../navigation';
import { resolveRouteAccess } from '../route-access';
import { resolveGuardOutcome } from '../routeGuardOutcome';

const allFeatures = () => true;
const noFeatures = () => false;
const base = { hasFeature: allFeatures, featuresReady: true };
const denyAll = () => false;
const allowAll = () => true;

describe('resolveGuardOutcome', () => {
  it('redirects a guarded route without permission to the denied screen', () => {
    expect(
      resolveGuardOutcome({ ...base, pathname: '/admin/events', can: denyAll, ready: true }),
    ).toEqual({ redirect: DENIED_ROUTE });
  });

  it('redirects home without permission to the welcome screen', () => {
    expect(
      resolveGuardOutcome({ ...base, pathname: DEFAULT_REDIRECT_HOME, can: denyAll, ready: true }),
    ).toEqual({ redirect: WELCOME_ROUTE });
  });

  it('allows a guarded route with permission', () => {
    const can = (check: PermissionCheck) => !!check[RESOURCES.EVENT]?.includes(ACTIONS.READ);
    expect(resolveGuardOutcome({ ...base, pathname: '/admin/events', can, ready: true })).toBe(
      'allow',
    );
  });

  it('allows a route with no guard', () => {
    expect(
      resolveGuardOutcome({ ...base, pathname: '/somewhere', can: denyAll, ready: true }),
    ).toBe('allow');
  });

  it('waits instead of redirecting while permissions are not ready', () => {
    expect(
      resolveGuardOutcome({ ...base, pathname: '/admin/events', can: denyAll, ready: false }),
    ).toBe('wait');
    expect(
      resolveGuardOutcome({ ...base, pathname: '/admin/events', can: allowAll, ready: false }),
    ).toBe('wait');
  });

  it('never redirects the denied and welcome screens', () => {
    expect(resolveRouteAccess(DENIED_ROUTE)).not.toBeTruthy();
    expect(resolveRouteAccess(WELCOME_ROUTE)).not.toBeTruthy();
    for (const pathname of [DENIED_ROUTE, WELCOME_ROUTE]) {
      expect(resolveGuardOutcome({ ...base, pathname, can: denyAll, ready: true })).toBe('allow');
    }
  });

  it('returns notFound for a module route whose feature is off', () => {
    expect(
      resolveGuardOutcome({
        ...base,
        pathname: '/admin/quotes',
        can: allowAll,
        ready: true,
        hasFeature: noFeatures,
      }),
    ).toBe('notFound');
  });

  it('waits while the features load, even with permissions ready', () => {
    expect(
      resolveGuardOutcome({
        ...base,
        pathname: '/admin/quotes',
        can: allowAll,
        ready: true,
        featuresReady: false,
        hasFeature: noFeatures,
      }),
    ).toBe('wait');
  });

  it('allows a module route once its feature is active', () => {
    const hasFeature = (key: string) => key === 'quotes';
    expect(
      resolveGuardOutcome({
        ...base,
        pathname: '/admin/quotes',
        can: allowAll,
        ready: true,
        hasFeature,
      }),
    ).toBe('allow');
  });

  it('inherits the events feature on the reschedule route', () => {
    const hasFeature = (key: string) => key === 'quotes';
    expect(
      resolveGuardOutcome({
        ...base,
        pathname: '/admin/events/123/reschedule',
        can: allowAll,
        ready: true,
        hasFeature,
      }),
    ).toBe('notFound');
  });

  it('does not affect core routes when every module is off', () => {
    expect(
      resolveGuardOutcome({
        ...base,
        pathname: '/admin/clients',
        can: allowAll,
        ready: true,
        hasFeature: noFeatures,
      }),
    ).toBe('allow');
  });

  it('redirects to denied, not notFound, when the user lacks permission and the module is off', () => {
    expect(
      resolveGuardOutcome({
        ...base,
        pathname: '/admin/quotes',
        can: denyAll,
        ready: true,
        hasFeature: noFeatures,
      }),
    ).toEqual({ redirect: DENIED_ROUTE });
  });

  it('returns notFound for the notifications center when notifications is off, allow when on', () => {
    const pathname = '/admin/notifications';
    expect(
      resolveGuardOutcome({
        ...base,
        pathname,
        can: allowAll,
        ready: true,
        hasFeature: noFeatures,
      }),
    ).toBe('notFound');
    expect(resolveGuardOutcome({ ...base, pathname, can: allowAll, ready: true })).toBe('allow');
  });
});
