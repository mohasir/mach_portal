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
import { TenancyRepository } from './tenancy/tenancy.repository';

const HTTP_BLOCKED_PREFIXES = ['/organization', '/admin'];
const HTTP_BLOCKED_PATHS = ['/sign-up/email'];

function isBlockedOverHttp(path: string | undefined): boolean {
  if (!path) return false;
  return (
    HTTP_BLOCKED_PATHS.includes(path) ||
    HTTP_BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  );
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
  trustedOrigins: env.WEB_ORIGIN,
  hooks: {
    // Plugin endpoints act on global tables (users, organizations) and would bypass the
    // tenant-scoped users module, so they are server-side only. `ctx.request` exists
    // only for HTTP, hence `auth.api.*` calls from services are unaffected. A prefix
    // match (unlike `disabledPaths`, which is exact) also covers endpoints added later.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.request && isBlockedOverHttp(ctx.path)) {
        throw APIError.from('NOT_FOUND', { code: 'NOT_FOUND', message: 'Not found' });
      }
      // The web never sets an avatar but does render `user.image`, so self-service updates may
      // not store an arbitrary URL there (e.g. `javascript:`).
      if (ctx.request && ctx.path === '/update-user' && ctx.body && 'image' in ctx.body) {
        throw APIError.from('BAD_REQUEST', { code: 'BAD_REQUEST', message: 'Bad request' });
      }
    }),
  },
  advanced: {
    // Host-only cookie: the session is never shared across subdomains.
    crossSubDomainCookies: { enabled: false },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (newSession, context) => {
          // Internal calls (e.g. auth.api.signUpEmail from a service) carry no request context
          // and keep their session without an active organization.
          if (!context?.request && !context?.headers) return;

          const tenancy = new TenancyRepository();
          const organizationIds = await tenancy.findMemberOrganizationIds(newSession.userId, 2);

          if (organizationIds.length === 1) {
            return { data: { ...newSession, activeOrganizationId: organizationIds[0]! } };
          }

          if (organizationIds.length === 0) {
            // Runs after the password was verified, so naming the problem leaks nothing.
            if (!(await tenancy.isPlatformAdmin(newSession.userId))) {
              throw APIError.from('FORBIDDEN', {
                code: ErrorCodes.user.NO_ORGANIZATION,
                message: 'User has no organization',
              });
            }
          }

          return { data: { ...newSession, activeOrganizationId: null } };
        },
      },
    },
  },
  session: {
    // The web middleware gates routes on the cached cookie (role, mustChangePassword); tRPC and the
    // upload guard bypass it. A short maxAge bounds how long Better Auth's get-session keeps
    // answering with a signed-out or changed session.
    cookieCache: { enabled: true, maxAge: 60 },
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
    }),
  ],
});
