import { router } from './trpc';
import { usersRouter } from '../modules/users/users.router';
import { clientsRouter } from '../modules/clients/clients.router';
import { staffRouter } from '../modules/staff/staff.router';
import { productsRouter } from '../modules/products/products.router';

export const appRouter = router({
  users: usersRouter,
  clients: clientsRouter,
  staff: staffRouter,
  products: productsRouter,
});

export type AppRouter = typeof appRouter;
