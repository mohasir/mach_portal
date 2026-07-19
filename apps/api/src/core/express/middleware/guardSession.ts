import type { NextFunction, Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { hasPermission, type PermissionCheck } from '@repo/guards';
import { auth } from '../../../lib/auth';

export function guardSession(permissions: PermissionCheck) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      query: { disableCookieCache: true },
    });
    if (!session) {
      res.status(401).json({ errorCode: 'UNAUTHORIZED' });
      return;
    }
    const role = (session.user as { role?: string | null }).role;
    if (!hasPermission(role, permissions)) {
      res.status(403).json({ errorCode: 'FORBIDDEN' });
      return;
    }
    res.locals['userId'] = session.user.id;
    next();
  };
}
