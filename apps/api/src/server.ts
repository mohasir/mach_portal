import express from 'express';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { auth } from './lib/auth';
import { appRouter } from './trpc/router';
import { createContext } from './trpc/context';
import { env } from './env';

const app = express();

app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));

app.use(['/api/auth', '/trpc'], (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// 1) Better Auth BEFORE express.json() — it parses its own body
app.all('/api/auth/*path', toNodeHandler(auth));

// 2) JSON parser for everything else
app.use(express.json());

// 3) tRPC
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, path, type, input }) {
      console.error(`[trpc] ${type} ${path ?? '<unknown>'}`, { input, error });
    },
  }),
);

app.listen(env.PORT, () => console.log(`API on :${env.PORT}`));
