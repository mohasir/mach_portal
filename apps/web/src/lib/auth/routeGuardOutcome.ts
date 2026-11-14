import type { FeatureKey, PermissionCheck } from '@repo/guards';
import { DEFAULT_REDIRECT_HOME, DENIED_ROUTE, WELCOME_ROUTE } from './navigation';
import { resolveRouteAccess, resolveRouteFeature } from './route-access';

export type GuardOutcome = 'allow' | 'wait' | 'notFound' | { redirect: string };

export function resolveGuardOutcome({
  pathname,
  can,
  ready,
  hasFeature,
  featuresReady,
}: {
  pathname: string;
  can: (check: PermissionCheck) => boolean;
  ready: boolean;
  hasFeature: (key: FeatureKey) => boolean;
  featuresReady: boolean;
}): GuardOutcome {
  // Denying before the grants or features load would bounce users who do have access.
  if (!ready || !featuresReady) return 'wait';
  const required = resolveRouteAccess(pathname);
  // Permission denial wins over an inactive module: a user who may not open the route anyway
  // should not learn which modules the organization has.
  if (required && !can(required)) {
    // The dashboard denial is a welcome landing; every other route is a 403.
    return { redirect: pathname === DEFAULT_REDIRECT_HOME ? WELCOME_ROUTE : DENIED_ROUTE };
  }
  const feature = resolveRouteFeature(pathname);
  if (feature && !hasFeature(feature)) return 'notFound';
  return 'allow';
}
