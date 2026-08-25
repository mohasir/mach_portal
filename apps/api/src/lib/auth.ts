import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { ac, roles, DEFAULT_ROLE, ADMIN_ROLES } from '@repo/guards';
import { db } from '../db';
import { env } from '../env';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: true },
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.WEB_ORIGIN,
  session: {
    cookieCache: { enabled: true, maxAge: 300 },
  },
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: DEFAULT_ROLE,
      adminRoles: ADMIN_ROLES,
    }),
  ],
});
