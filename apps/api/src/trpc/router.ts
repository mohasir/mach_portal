import { router } from './trpc';
import { usersRouter } from '../modules/users/users.router';
import { clientsRouter } from '../modules/clients/clients.router';
import { staffRouter } from '../modules/staff/staff.router';
import { productsRouter } from '../modules/products/products.router';
import { eventTypesRouter } from '../modules/eventTypes/eventTypes.router';
import { configRouter } from '../modules/config/config.router';

export const appRouter = router({
  users: usersRouter,
  clients: clientsRouter,
  staff: staffRouter,
  products: productsRouter,
  eventTypes: eventTypesRouter,
  config: configRouter,
});

export type AppRouter = typeof appRouter;
