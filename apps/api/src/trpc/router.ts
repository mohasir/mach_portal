import { router } from './trpc';
import { usersRouter } from '../modules/users/users.router';
import { clientsRouter } from '../modules/clients/clients.router';

export const appRouter = router({
  users: usersRouter,
  clients: clientsRouter,
});

export type AppRouter = typeof appRouter;
