import type { CreateExpressContextOptions } from '@trpc/server/adapters/express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/auth';

export async function createContext({ req, res }: CreateExpressContextOptions) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
    query: { disableCookieCache: true },
  });
  return { req, res, session };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
