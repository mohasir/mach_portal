import type { Context } from '../core/trpc/context';
import type { Database } from '../db';
import { appRouter } from '../core/trpc/router';

// Calls the real app router as a signed-in user whose session has `tenant` active, skipping
// Better Auth: authorization still runs the full tenant chain against the database. `database` is
// the client the chain opens its transactions on (e.g. an app-role client to exercise RLS).
export function callerFor(
  tenant: { id: string; slug: string },
  user: { id: string },
  database?: Database,
) {
  const ctx = {
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
  return appRouter.createCaller(ctx);
}
