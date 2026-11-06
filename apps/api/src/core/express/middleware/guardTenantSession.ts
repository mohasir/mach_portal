import type { Request, RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { hasPermission, ROLES, type PermissionCheck } from '@repo/guards';
import { auth } from '../../../lib/auth';
import { ErrorCodes } from '../../../lib/errors';
import { evaluateTenantAccess } from '../../../lib/tenancy/access';
import { resolveTenantById } from '../../../lib/tenancy/tenantResolver';
import { recordPlatformAccess } from '../../trpc/platformAccess';

const READ_METHODS = new Set(['GET', 'HEAD']);

// Mirrors the tRPC chain (tenantProcedure -> protectedProcedure -> guardedProcedure) check for
// check and in the same order, for routes that cannot go through tRPC (e.g. multipart uploads).
export function guardTenantSession(permissions: PermissionCheck): RequestHandler {
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
      const { isPlatformAdmin, mustChangePassword, role } = user as {
        isPlatformAdmin?: boolean | null;
        mustChangePassword?: boolean | null;
        role?: string | null;
      };

      const access = await evaluateTenantAccess({
        userId: user.id,
        isPlatformAdmin,
        tenantId: tenant.id,
      });
      if (!access.allowed) {
        res.status(403).json({ errorCode: 'FORBIDDEN' });
        return;
      }

      if (mustChangePassword) {
        res.status(403).json({ errorCode: ErrorCodes.user.MUST_CHANGE_PASSWORD });
        return;
      }

      if (access.platformAccess) {
        await recordPlatformAccess({
          userId: user.id,
          tenantId: tenant.id,
          sessionId: session.id,
          path: req.baseUrl + req.path,
          type: READ_METHODS.has(req.method) ? 'query' : 'mutation',
        });
      }

      const effectiveRole = access.platformAccess ? ROLES.SUPERADMIN : role;
      if (!hasPermission(effectiveRole, permissions)) {
        res.status(403).json({ errorCode: 'FORBIDDEN' });
        return;
      }

      res.locals['tenantId'] = tenant.id;
      res.locals['userId'] = user.id;
      next();
    } catch (err) {
      console.error('guardTenantSession failed', err);
      if (!res.headersSent) res.status(500).json({ errorCode: 'INTERNAL_ERROR' });
    }
  };
}
