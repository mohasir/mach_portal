import { initTRPC, TRPCError } from '@trpc/server';
import { moduleOfResource, type FeatureKey, type PermissionCheck } from '@repo/guards';
import { AppError, ErrorCodes } from '../../lib/errors';

type FeaturesCtx = { features: ReadonlySet<FeatureKey> };

export function featureNotEnabled(feature: FeatureKey): TRPCError {
  return new TRPCError({
    code: 'FORBIDDEN',
    cause: new AppError(ErrorCodes.feature.NOT_ENABLED, undefined, 403, { feature }),
  });
}

// First module named by the check's resources that the tenant does not have active.
export function inactiveModuleOf(
  features: ReadonlySet<FeatureKey>,
  permissions: PermissionCheck,
): FeatureKey | undefined {
  for (const resource of Object.keys(permissions)) {
    const module = moduleOfResource(resource);
    if (module && !features.has(module)) return module;
  }
  return undefined;
}

// Only on the tenant chain, which puts `features` in the context. Queries pass: the data of a
// feature that was switched off stays readable.
const t = initTRPC.context<FeaturesCtx>().create();

export function requireFeature(key: FeatureKey) {
  return t.middleware(({ ctx, type, next }) => {
    if (type === 'mutation' && !ctx.features.has(key)) throw featureNotEnabled(key);
    return next();
  });
}
