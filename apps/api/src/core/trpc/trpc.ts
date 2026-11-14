import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { can, type FeatureKey, type PermissionCheck } from '@repo/guards';
import type { Context } from './context';
import { db, type Database, type TenantRunner } from '../../db';
import { withTenantTx } from '../../db/rls/tenantTx';
import { AppError, ErrorCodes } from '../../lib/errors';
import { getTenantFeatures } from '../../lib/features/cache';
import { loadTenantFeatures } from '../../lib/features/repository';
import {
  OWNER_ACCESS,
  permissionsVersion,
  resolveAccess,
  type ResolvedAccess,
} from '../../lib/rbac/access';
import { evaluateTenantAccess } from '../../lib/tenancy/access';
import { HEADERS } from '../express/const/headers';
import { recordPlatformAccess } from './platformAccess';
import { featureNotEnabled, inactiveModuleOf } from './requireFeature';
import type { AfterCommit } from './tenantCtx';

export type ProcedureMeta = {
  // Set by shortTxProcedure: the chain opens no request transaction for the procedure.
  shortTx?: boolean;
};

const t = initTRPC
  .context<Context>()
  .meta<ProcedureMeta>()
  .create({
    errorFormatter({ shape, error }) {
      const zodError = error.cause instanceof ZodError ? error.cause : null;
      // An unexpected error's message (and stack) can carry raw SQL, bound params and ids, in dev
      // too; the full error is only logged server-side by the adapter's onError.
      const unexpected =
        error.code === 'INTERNAL_SERVER_ERROR' && !(error.cause instanceof AppError);
      const data = { ...shape.data };
      if (zodError || unexpected) delete data.stack;
      return {
        ...shape,
        message: zodError ? 'Invalid input' : unexpected ? 'Internal server error' : shape.message,
        data: {
          ...data,
          errorCode: error.cause instanceof AppError ? error.cause.code : null,
          errorDetails: error.cause instanceof AppError ? (error.cause.details ?? null) : null,
          fieldErrors: zodError
            ? zodError.issues.map((issue) => ({ path: issue.path, message: issue.message }))
            : null,
        },
      };
    },
  });

export const router = t.router;
export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const tenantProcedure = authedProcedure.use(({ ctx, next }) => {
  if (!ctx.session.session.activeOrganizationId) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: new AppError(ErrorCodes.tenant.NOT_SELECTED),
    });
  }
  // The active organization exists on the session but could not be loaded: it was deleted.
  if (!ctx.tenant) {
    throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.tenant.NOT_FOUND) });
  }
  return next({ ctx: { ...ctx, tenant: ctx.tenant } });
});

type TenantChainCtx = Context & {
  session: NonNullable<Context['session']>;
  tenant: NonNullable<Context['tenant']>;
};

function userFlags(ctx: TenantChainCtx) {
  return ctx.session.user as {
    isPlatformAdmin?: boolean | null;
    mustChangePassword?: boolean | null;
  };
}

// Membership is read from identity tables outside RLS, so it needs no tenant transaction.
async function evaluateEntry(ctx: TenantChainCtx, database: Database) {
  const entry = await evaluateTenantAccess(
    {
      userId: ctx.session.user.id,
      isPlatformAdmin: userFlags(ctx).isPlatformAdmin,
      tenantId: ctx.tenant.id,
    },
    database,
  );
  if (!entry.allowed) throw new TRPCError({ code: 'FORBIDDEN' });
  return entry;
}

function admit(ctx: TenantChainCtx, access: ResolvedAccess | null): ResolvedAccess {
  if (!access) throw new TRPCError({ code: 'FORBIDDEN' });
  if (userFlags(ctx).mustChangePassword) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: new AppError(ErrorCodes.user.MUST_CHANGE_PASSWORD),
    });
  }
  ctx.res.setHeader(HEADERS.PERMISSIONS_VERSION, permissionsVersion(access));
  return access;
}

// Runs before any request transaction opens: the audit commits on its own connection, so it
// survives a failed request, and no request holds a connection while waiting for another one.
async function admitPlatformAccess(
  ctx: TenantChainCtx,
  path: string,
  type: string,
  database: Database,
): Promise<ResolvedAccess> {
  const access = admit(ctx, OWNER_ACCESS);
  await recordPlatformAccess(
    {
      userId: ctx.session.user.id,
      tenantId: ctx.tenant.id,
      sessionId: ctx.session.session.id,
      path,
      type: type === 'mutation' ? 'mutation' : 'query',
    },
    database,
  );
  return access;
}

// The request is already committed when these run, so a failing task must not turn it into an
// error for the client nor keep the remaining tasks from running.
function runAfterCommit(task: () => void) {
  try {
    task();
  } catch (err) {
    console.error('after-commit task failed', err);
  }
}

function tenantRunner(tenantId: string, database: Database): TenantRunner {
  return (fn) => withTenantTx(tenantId, fn, database);
}

export const protectedProcedure = tenantProcedure.use(async ({ ctx, next, path, type, meta }) => {
  if (meta?.shortTx) throw new Error(`${path}: shortTx procedures must use shortTxProcedure`);
  const { session, user } = ctx.session;
  const tenantId = ctx.tenant.id;
  const database = ctx.database ?? db;
  const runInTenant = tenantRunner(tenantId, database);

  const entry = await evaluateEntry(ctx, database);
  const platformAccess = entry.platformAccess
    ? await admitPlatformAccess(ctx, path, type, database)
    : null;

  const committed: Array<() => void> = [];
  const afterCommit: AfterCommit = (task) => {
    committed.push(task);
  };
  const result = await withTenantTx(
    tenantId,
    async (tx) => {
      const access =
        platformAccess ?? admit(ctx, await resolveAccess({ userId: user.id, tenantId }, tx));
      // A savepoint: a failed read must not abort the request transaction, since the cache then
      // falls back to the core features and the procedure goes on.
      const features = await getTenantFeatures(tenantId, () =>
        tx.transaction((sp) => loadTenantFeatures(tenantId, sp)),
      );
      const result = await next({
        ctx: {
          ...ctx,
          tenantId,
          user,
          session,
          access,
          features,
          db: tx,
          runInTenant,
          afterCommit,
        },
      });
      // next() reports a failure instead of throwing; rethrowing the same error rolls the
      // transaction back and still reaches the client unchanged.
      if (!result.ok) throw result.error;
      return result;
    },
    database,
  );
  committed.forEach(runAfterCommit);
  return result;
});

// Same checks as protectedProcedure, but holds no transaction across the procedure: it opens
// short ones through ctx.runInTenant around slow external calls.
export const shortTxProcedure = tenantProcedure
  .meta({ shortTx: true })
  .use(async ({ ctx, next, path, type }) => {
    const { session, user } = ctx.session;
    const tenantId = ctx.tenant.id;
    const database = ctx.database ?? db;
    const runInTenant = tenantRunner(tenantId, database);

    const entry = await evaluateEntry(ctx, database);
    const access = entry.platformAccess
      ? await admitPlatformAccess(ctx, path, type, database)
      : admit(ctx, await runInTenant((tx) => resolveAccess({ userId: user.id, tenantId }, tx)));
    const features = await getTenantFeatures(tenantId, () =>
      runInTenant((tx) => loadTenantFeatures(tenantId, tx)),
    );

    // Each runInTenant commits on its own, so there is nothing left to wait for.
    const afterCommit: AfterCommit = runAfterCommit;
    return next({
      ctx: { ...ctx, tenantId, user, session, access, features, runInTenant, afterCommit },
    });
  });

// Mutations on a resource whose module is inactive are blocked; queries pass, so the data of a
// module that was switched off stays readable.
function assertModulesActive(
  features: ReadonlySet<FeatureKey>,
  type: string,
  permissions: PermissionCheck,
) {
  if (type !== 'mutation') return;
  const inactive = inactiveModuleOf(features, permissions);
  if (inactive) throw featureNotEnabled(inactive);
}

export function guardedProcedure(permissions: PermissionCheck) {
  return protectedProcedure.use(({ ctx, next, type }) => {
    if (!can(ctx.access, permissions)) throw new TRPCError({ code: 'FORBIDDEN' });
    assertModulesActive(ctx.features, type, permissions);
    return next();
  });
}

export function guardedShortTxProcedure(permissions: PermissionCheck) {
  return shortTxProcedure.use(({ ctx, next, type }) => {
    if (!can(ctx.access, permissions)) throw new TRPCError({ code: 'FORBIDDEN' });
    assertModulesActive(ctx.features, type, permissions);
    return next();
  });
}

// Passes when any one of the checks is fully met, its modules included. When the role meets some
// checks but all of them sit on inactive modules, the error names the module, not the role.
export function guardedProcedureAnyOf(...checks: [PermissionCheck, ...PermissionCheck[]]) {
  return protectedProcedure.use(({ ctx, next, type }) => {
    const allowed = checks.filter((check) => can(ctx.access, check));
    if (allowed.length === 0) throw new TRPCError({ code: 'FORBIDDEN' });
    if (type === 'mutation') {
      const inactive = allowed.map((check) => inactiveModuleOf(ctx.features, check));
      if (inactive.every(Boolean)) throw featureNotEnabled(inactive[0]!);
    }
    return next();
  });
}
