import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../lib/auth';
import { resolveTenantById, type Tenant } from '../../lib/tenancy/tenantResolver';

export async function createContext({ req, res }: CreateExpressContextOptions) {
  // Bypassing the cookie cache makes an organization switch visible on the very next request.
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
    query: { disableCookieCache: true },
  });
  const activeOrganizationId = session?.session.activeOrganizationId;
  const tenant: Tenant | null = activeOrganizationId
    ? await resolveTenantById(activeOrganizationId)
    : null;
  return { req, res, session, tenant };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
