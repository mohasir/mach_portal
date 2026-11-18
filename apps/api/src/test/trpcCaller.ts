import type { Context } from '../core/trpc/context';
import type { Database } from '../db';
import { appRouter } from '../core/trpc/router';
import { testDb } from './db';

// Context of a signed-in user whose session has `tenant` active, skipping Better Auth:
// authorization still runs the full tenant chain against the database. `database` is the client
// the chain opens its transactions on (e.g. an app-role client to exercise RLS).
export function testContext(
  tenant: { id: string; slug: string },
  user: { id: string },
  database?: Database,
): Context {
  return {
    req: {},
    res: { setHeader: () => undefined },
    session: {
      session: { id: `sess-${user.id}`, userId: user.id, activeOrganizationId: tenant.id },
      user: {
        id: user.id,
        name: `user ${user.id}`,
        image: null,
        role: 'user',
        mustChangePassword: false,
        isPlatformAdmin: false,
      },
    },
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.slug },
    database,
  } as unknown as Context;
}

// Calls the real app router through `testContext`.
export function callerFor(
  tenant: { id: string; slug: string },
  user: { id: string },
  database?: Database,
) {
  return appRouter.createCaller(testContext(tenant, user, database));
}

// Context of a signed-in user with no active organization, for the platform console. The session
// flag is only what a stale cookie would say: console procedures re-read it from the database.
export function consoleCallerFor(
  user: { id: string; isPlatformAdmin?: boolean },
  opts: { database?: Database; sessionId?: string } = {},
) {
  const ctx = {
    req: {},
    res: { setHeader: () => undefined },
    session: {
      session: {
        id: opts.sessionId ?? `sess-${user.id}`,
        userId: user.id,
        activeOrganizationId: null,
      },
      user: {
        id: user.id,
        name: `user ${user.id}`,
        image: null,
        role: 'user',
        mustChangePassword: false,
        isPlatformAdmin: user.isPlatformAdmin ?? true,
      },
    },
    tenant: null,
    platformDatabase: opts.database ?? testDb,
  } as unknown as Context;
  return appRouter.createCaller(ctx);
}
