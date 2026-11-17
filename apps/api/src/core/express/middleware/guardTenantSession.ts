import type { Request, RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { can, type PermissionCheck } from '@repo/guards';
import { db, withTenantTx, type Database, type TenantRunner } from '../../../db';
import { auth } from '../../../lib/auth';
import { ErrorCodes } from '../../../lib/errors';
import { getTenantFeatures } from '../../../lib/features/cache';
import { loadTenantFeatures } from '../../../lib/features/repository';
import { OWNER_ACCESS, resolveAccess } from '../../../lib/rbac/access';
import { evaluateTenantAccess } from '../../../lib/tenancy/access';
import { resolveTenantById } from '../../../lib/tenancy/tenantResolver';
import { recordPlatformAccess } from '../../trpc/platformAccess';
import { inactiveModuleOf } from '../../trpc/requireFeature';

const READ_METHODS = new Set(['GET', 'HEAD']);

// Mirrors the tRPC chain (tenantProcedure -> shortTxProcedure -> guard) check for check and in the
// same order, for routes that cannot go through tRPC (e.g. multipart uploads). Like
// shortTxProcedure it holds no transaction across the handler: these routes make slow external
// calls, so the handler opens short tenant transactions through res.locals.runInTenant.
export function guardTenantSession(
  permissions: PermissionCheck,
  database: Database = db,
): RequestHandler {
  return async (req: Request, res, next) => {
    try {
      const current = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
        query: { disableCookieCache: true },
      });
      if (!current) {
        res.status(401).json({ errorCode: 'UNAUTHORIZED' });
        return;
      }

      const { activeOrganizationId } = current.session;
      if (!activeOrganizationId) {
        res.status(403).json({ errorCode: ErrorCodes.tenant.NOT_SELECTED });
        return;
      }
      const tenant = await resolveTenantById(activeOrganizationId);
      if (!tenant) {
        res.status(404).json({ errorCode: ErrorCodes.tenant.NOT_FOUND });
        return;
      }

      const { user, session } = current;
      const { isPlatformAdmin, mustChangePassword } = user as {
        isPlatformAdmin?: boolean | null;
        mustChangePassword?: boolean | null;
      };

      // Membership lives in identity tables outside RLS; role and role_permission need the tenant set.
      const entry = await evaluateTenantAccess(
        { userId: user.id, isPlatformAdmin, tenantId: tenant.id },
        database,
      );
      const access = !entry.allowed
        ? null
        : entry.platformAccess
          ? OWNER_ACCESS
          : await withTenantTx(
              tenant.id,
              (tx) => resolveAccess({ userId: user.id, tenantId: tenant.id }, tx),
              database,
            );
      if (!access) {
        res.status(403).json({ errorCode: 'FORBIDDEN' });
        return;
      }

      if (mustChangePassword) {
        res.status(403).json({ errorCode: ErrorCodes.user.MUST_CHANGE_PASSWORD });
        return;
      }

      if (entry.allowed && entry.platformAccess) {
        await recordPlatformAccess(
          {
            userId: user.id,
            tenantId: tenant.id,
            sessionId: session.id,
            path: req.baseUrl + req.path,
            type: READ_METHODS.has(req.method) ? 'query' : 'mutation',
          },
          database,
        );
      }

      if (!can(access, permissions)) {
        res.status(403).json({ errorCode: 'FORBIDDEN' });
        return;
      }

      const runInTenant: TenantRunner = (fn) => withTenantTx(tenant.id, fn, database);
      // Same module rule as the tRPC guards: writes need the module active, reads pass.
      if (!READ_METHODS.has(req.method)) {
        const features = await getTenantFeatures(tenant.id, () =>
          runInTenant((tx) => loadTenantFeatures(tenant.id, tx)),
        );
        if (inactiveModuleOf(features, permissions)) {
          res.status(403).json({ errorCode: ErrorCodes.feature.NOT_ENABLED });
          return;
        }
        res.locals['features'] = features;
      }

      res.locals['tenantId'] = tenant.id;
      res.locals['userId'] = user.id;
      res.locals['access'] = access;
      res.locals['runInTenant'] = runInTenant;
      next();
    } catch (err) {
      console.error('guardTenantSession failed', err);
      if (!res.headersSent) res.status(500).json({ errorCode: 'INTERNAL_ERROR' });
    }
  };
}
