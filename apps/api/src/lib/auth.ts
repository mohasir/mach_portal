import { eq } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin, organization } from 'better-auth/plugins';
import { ac, roles, DEFAULT_ROLE, ADMIN_ROLES } from '@repo/guards';
import { db } from '../db';
import { user } from '../db/schema';
import { env } from '../env';
import { ErrorCodes } from './errors/constants';
import { isAllowedOrigin } from './tenant/allowedOrigin';
import { readTenantHost } from './tenant/forwardedHost';
import { parseTenantSlug } from './tenant/host';
import { isMemberOf } from './tenant/membership';
import { resolveTenantBySlug } from './tenant/tenantResolver';

// Code and message match Better Auth's built-in wrong-password error, so a non-member's
// login failure is indistinguishable from a bad password.
const INVALID_CREDENTIALS = {
  code: ErrorCodes.auth.INVALID_EMAIL_OR_PASSWORD,
  message: 'Invalid email or password',
} as const;

const HTTP_BLOCKED_PREFIXES = ['/organization', '/admin'];
const HTTP_BLOCKED_PATHS = ['/sign-up/email'];

function isBlockedOverHttp(path: string | undefined): boolean {
  if (!path) return false;
  return (
    HTTP_BLOCKED_PATHS.includes(path) ||
    HTTP_BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  );
}

function requestOrigin(request: Request | undefined): string | undefined {
  const origin = request?.headers.get('origin');
  if (origin) return origin;
  // Mirrors Better Auth's own origin check, which falls back to Referer.
  const referer = request?.headers.get('referer');
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user: resetUser }) => {
      await db.update(user).set({ mustChangePassword: false }).where(eq(user.id, resetUser.id));
    },
  },
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: async (request) => {
    const origin = requestOrigin(request);
    return origin && (await isAllowedOrigin(origin)) ? [origin] : [];
  },
  hooks: {
    // Plugin endpoints act on global tables (users, organizations) and would bypass the
    // tenant-scoped users module, so they are server-side only. `ctx.request` exists
    // only for HTTP, hence `auth.api.*` calls from services are unaffected. A prefix
    // match (unlike `disabledPaths`, which is exact) also covers endpoints added later.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.request && isBlockedOverHttp(ctx.path)) {
        throw APIError.from('NOT_FOUND', { code: 'NOT_FOUND', message: 'Not found' });
      }
    }),
  },
  advanced: {
    // Host-only cookies keep each tenant's session isolated to its own subdomain.
    crossSubDomainCookies: { enabled: false },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (newSession, context) => {
          // Internal calls (e.g. auth.api.signUpEmail from a service) carry no request:
          // the session is left without an active tenant, which protectedProcedure rejects.
          const headers = context?.request?.headers ?? context?.headers;
          if (!headers) return;

          const slug = parseTenantSlug(
            readTenantHost(Object.fromEntries(headers.entries())),
            env.APP_BASE_DOMAIN,
          );
          const tenant = slug ? await resolveTenantBySlug(slug) : null;
          const [account] = tenant
            ? await db
                .select({ isPlatformAdmin: user.isPlatformAdmin })
                .from(user)
                .where(eq(user.id, newSession.userId))
                .limit(1)
            : [];
          const allowed =
            tenant &&
            (account?.isPlatformAdmin || (await isMemberOf(newSession.userId, tenant.id)));
          if (!tenant || !allowed) throw APIError.from('UNAUTHORIZED', INVALID_CREDENTIALS);

          return { data: { ...newSession, activeOrganizationId: tenant.id } };
        },
      },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 300 },
  },
  user: {
    additionalFields: {
      mustChangePassword: { type: 'boolean', defaultValue: false, input: false },
      isPlatformAdmin: { type: 'boolean', defaultValue: false, input: false },
    },
  },
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: DEFAULT_ROLE,
      adminRoles: ADMIN_ROLES,
    }),
    organization({
      teams: { enabled: false },
      allowUserToCreateOrganization: false,
      schema: {
        organization: {
          additionalFields: {
            customDomain: { type: 'string', required: false },
          },
        },
      },
    }),
  ],
});
