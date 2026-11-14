import type { ShortTxCtx, TenantCtx } from '../../core/trpc/tenantCtx';
import { ConfigRepository } from '../config/config.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { ProductsRepository } from '../products/products.repository';
import { TemplatesRepository } from '../templates/templates.repository';
import { QuotesRepository } from './quotes.repository';
import { QuotePdfGenerator, QuotesService } from './quotes.service';

// The tenant always comes from the session (ctx), so a background run can never be pointed at
// another organization by its input.
function quotePdfGenerator(ctx: Pick<ShortTxCtx, 'tenantId' | 'runInTenant' | 'features'>) {
  return new QuotePdfGenerator(
    ctx.runInTenant,
    (tx) => ({
      quotes: new QuotesRepository(tx, ctx.tenantId),
      products: new ProductsRepository(tx, ctx.tenantId),
      templates: new TemplatesRepository(tx, ctx.tenantId),
    }),
    ctx.features.has('priceTiers'),
  );
}

// Client, event type, catalog and assignee ids from `input` are resolved inside the tenant by
// QuotesRepository (and its catalog context) before anything references them.
export function quotesModule(ctx: TenantCtx) {
  return new QuotesService(
    new QuotesRepository(ctx.db, ctx.tenantId),
    new ConfigRepository(ctx.db, ctx.tenantId),
    new NotificationsRepository(ctx.db, ctx.tenantId),
    quotePdfGenerator(ctx),
    ctx.afterCommit,
    ctx.features.has('priceTiers'),
    ctx.features.has('events'),
  );
}

// For shortTxProcedure: no request transaction, every read and write opens its own short one.
export function quotesPdfModule(ctx: ShortTxCtx) {
  return quotePdfGenerator(ctx);
}
