import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

export function productsModule(ctx: TenantCtx) {
  return new ProductsService(new ProductsRepository(db, ctx.tenantId));
}
