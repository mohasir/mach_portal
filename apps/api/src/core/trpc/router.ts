import { router } from './trpc';
import { dashboardRouter } from '../../modules/dashboard/dashboard.router';
import { usersRouter } from '../../modules/users/users.router';
import { clientsRouter } from '../../modules/clients/clients.router';
import { staffRouter } from '../../modules/staff/staff.router';
import { productsRouter } from '../../modules/products/products.router';
import { eventTypesRouter } from '../../modules/eventTypes/eventTypes.router';
import { configRouter } from '../../modules/config/config.router';
import { quotesRouter } from '../../modules/quotes/quotes.router';
import { eventsRouter } from '../../modules/events/events.router';
import { paymentsRouter } from '../../modules/payments/payments.router';
import { templatesRouter } from '../../modules/templates/templates.router';
import { notificationsRouter } from '../../modules/notifications/notifications.router';

export const appRouter = router({
  dashboard: dashboardRouter,
  users: usersRouter,
  clients: clientsRouter,
  staff: staffRouter,
  products: productsRouter,
  eventTypes: eventTypesRouter,
  config: configRouter,
  quotes: quotesRouter,
  events: eventsRouter,
  payments: paymentsRouter,
  templates: templatesRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
