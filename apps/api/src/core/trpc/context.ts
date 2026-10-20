import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { fromNodeHeaders } from 'better-auth/node';
import { env } from '../../env';
import { auth } from '../../lib/auth';
import { readTenantHost } from '../../lib/tenant/forwardedHost';
import { parseTenantSlug } from '../../lib/tenant/host';
import { resolveTenantBySlug, type Tenant } from '../../lib/tenant/tenantResolver';

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
    query: { disableCookieCache: true },
  });
  const slug = parseTenantSlug(readTenantHost(req.headers), env.APP_BASE_DOMAIN);
  const tenant: Tenant | null = slug ? await resolveTenantBySlug(slug) : null;
  return { req, res, session, tenant };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
