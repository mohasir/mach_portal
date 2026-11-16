import { ACTIONS, can, RESOURCES } from '@repo/guards';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

export function productsModule(ctx: TenantCtx) {
  return new ProductsService(
    new ProductsRepository(ctx.db, ctx.tenantId),
    ctx.features.has('priceTiers'),
    {
      read: can(ctx.access, { [RESOURCES.PRODUCT_COST]: [ACTIONS.READ] }),
      update: can(ctx.access, { [RESOURCES.PRODUCT_COST]: [ACTIONS.UPDATE] }),
    },
  );
}
