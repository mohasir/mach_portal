import type { PermissionCheck } from '@repo/guards';
import { DEFAULT_REDIRECT_HOME, DENIED_ROUTE, WELCOME_ROUTE } from './navigation';
import { resolveRouteAccess } from './route-access';

export type GuardOutcome = 'allow' | 'wait' | { redirect: string };

export function resolveGuardOutcome({
  pathname,
  can,
  ready,
}: {
  pathname: string;
  can: (check: PermissionCheck) => boolean;
  ready: boolean;
}): GuardOutcome {
  // Denying before the grants load would bounce users who do have access.
  if (!ready) return 'wait';
  const required = resolveRouteAccess(pathname);
  if (!required || can(required)) return 'allow';
  // The dashboard denial is a welcome landing; every other route is a 403.
  return { redirect: pathname === DEFAULT_REDIRECT_HOME ? WELCOME_ROUTE : DENIED_ROUTE };
}
