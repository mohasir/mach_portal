import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { auth } from './lib/auth';
import { corsMiddleware } from './core/express/cors';
import { HEADERS, HEADER_VALUES } from './core/express/const/headers';
import { originGuard } from './core/express/originGuard';
import { securityHeaders } from './core/express/securityHeaders';
import { TRPC_MAX_BATCH_SIZE } from './core/trpc/batch';
import { appRouter } from './core/trpc/router';
import { createContext } from './core/trpc/context';
import { queryClient } from './db';
import { assertAppRoleRestricted } from './db/rls/roleGuard';
import { env } from './env';
import { eventAttachmentsRouter } from './modules/events/events.express';

const app = express();
app.disable('x-powered-by');

app.use(securityHeaders(process.env.NODE_ENV === 'production'));
app.use(corsMiddleware);
// Better Auth runs its own Origin check on /api/auth.
app.use(['/trpc', '/api/uploads'], originGuard);

app.use(['/api/auth', '/trpc'], (_req, res, next) => {
  res.setHeader(HEADERS.CACHE_CONTROL, HEADER_VALUES.CACHE_NO_STORE);
  next();
});

// 1) Better Auth BEFORE express.json() — it parses its own body
app.all('/api/auth/*path', toNodeHandler(auth));

app.use('/api/uploads/event-payments', eventAttachmentsRouter);

// 2) JSON parser for everything else
app.use(express.json());

// 3) tRPC
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    maxBatchSize: TRPC_MAX_BATCH_SIZE,
    onError({ error, path, type, input }) {
      console.error(`[trpc] ${type} ${path ?? '<unknown>'}`, { input, error });
    },
  }),
);

// Crons are not scheduled here: jobs run through their scripts, for one organization or for all
// (`pnpm --filter api jobs:event-reminders -- --tenant=<slug>` or `-- --all`).

assertAppRoleRestricted(queryClient).then(
  () => app.listen(env.PORT, () => console.log(`API on :${env.PORT}`)),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
