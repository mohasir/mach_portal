import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { auth } from './lib/auth';
import { corsMiddleware } from './core/express/cors';
import { originGuard } from './core/express/originGuard';
import { securityHeaders } from './core/express/securityHeaders';
import { TRPC_MAX_BATCH_SIZE } from './core/trpc/batch';
import { appRouter } from './core/trpc/router';
import { createContext } from './core/trpc/context';
import { env } from './env';
import { eventAttachmentsRouter } from './modules/events/events.express';

const app = express();
app.disable('x-powered-by');

app.use(securityHeaders(process.env.NODE_ENV === 'production'));
app.use(corsMiddleware);
// Better Auth runs its own Origin check on /api/auth.
app.use(['/trpc', '/api/uploads'], originGuard);

app.use(['/api/auth', '/trpc'], (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
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

// Crons are not scheduled: they do not iterate over tenants yet. Run a job per tenant with its
// script instead (e.g. `pnpm --filter api jobs:event-reminders -- --tenant=<slug>`).

app.listen(env.PORT, () => console.log(`API on :${env.PORT}`));
