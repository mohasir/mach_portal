import { router } from './trpc';
import { usersRouter } from '../../modules/users/users.router';
import { clientsRouter } from '../../modules/clients/clients.router';
import { staffRouter } from '../../modules/staff/staff.router';
import { productsRouter } from '../../modules/products/products.router';
import { eventTypesRouter } from '../../modules/eventTypes/eventTypes.router';
import { configRouter } from '../../modules/config/config.router';
import { quotesRouter } from '../../modules/quotes/quotes.router';
import { eventsRouter } from '../../modules/events/events.router';
import { templatesRouter } from '../../modules/templates/templates.router';

export const appRouter = router({
  users: usersRouter,
  clients: clientsRouter,
  staff: staffRouter,
  products: productsRouter,
  eventTypes: eventTypesRouter,
  config: configRouter,
  quotes: quotesRouter,
  events: eventsRouter,
  templates: templatesRouter,
});

export type AppRouter = typeof appRouter;
