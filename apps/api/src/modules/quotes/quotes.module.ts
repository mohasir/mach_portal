import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { ConfigRepository } from '../config/config.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { ProductsRepository } from '../products/products.repository';
import { TemplatesRepository } from '../templates/templates.repository';
import { QuotesRepository } from './quotes.repository';
import { QuotesService } from './quotes.service';

// Client, event type, catalog and assignee ids from `input` are resolved inside the tenant by
// QuotesRepository (and its catalog context) before anything references them.
export function quotesModule(ctx: TenantCtx) {
  return new QuotesService(
    new QuotesRepository(db, ctx.tenantId),
    new ConfigRepository(db, ctx.tenantId),
    new ProductsRepository(db, ctx.tenantId),
    new TemplatesRepository(db, ctx.tenantId),
    new NotificationsRepository(db, ctx.tenantId),
  );
}
