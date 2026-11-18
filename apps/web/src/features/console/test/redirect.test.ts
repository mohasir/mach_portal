import { describe, expect, it } from 'vitest';
import {
  CONSOLE_ROUTE,
  DEFAULT_REDIRECT_HOME,
  homeRouteFor,
  isProtectedRoute,
  resolveHomeTarget,
} from '@/lib/auth/navigation';

describe('homeRouteFor', () => {
  it('sends a platform admin to /console', () => {
    expect(homeRouteFor({ isPlatformAdmin: true })).toBe(CONSOLE_ROUTE);
  });

  it('sends any other user to /admin', () => {
    expect(homeRouteFor({ isPlatformAdmin: false })).toBe(DEFAULT_REDIRECT_HOME);
  });

  it('treats a missing flag as not admin', () => {
    expect(homeRouteFor({})).toBe(DEFAULT_REDIRECT_HOME);
    expect(homeRouteFor({ isPlatformAdmin: null })).toBe(DEFAULT_REDIRECT_HOME);
  });
});

describe('resolveHomeTarget', () => {
  it('waits while the session is pending', () => {
    expect(resolveHomeTarget({ isPending: true, user: null })).toBe('loading');
  });

  it('sends a missing session to /admin so AuthProvider handles stale cookies', () => {
    // Going to /login would loop: the middleware sends a request with a session cookie back to /.
    expect(resolveHomeTarget({ isPending: false, user: null })).toEqual({
      redirect: DEFAULT_REDIRECT_HOME,
    });
  });

  it('routes a signed-in user by role', () => {
    expect(resolveHomeTarget({ isPending: false, user: { isPlatformAdmin: true } })).toEqual({
      redirect: CONSOLE_ROUTE,
    });
    expect(resolveHomeTarget({ isPending: false, user: {} })).toEqual({
      redirect: DEFAULT_REDIRECT_HOME,
    });
  });
});

describe('console routes', () => {
  it('protects /console and its subpaths', () => {
    expect(isProtectedRoute('/console')).toBe(true);
    expect(isProtectedRoute('/console/organizations/abc')).toBe(true);
  });
});
