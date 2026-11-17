import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { ProductCategoriesRepository } from './productCategories.repository';
import { ProductCategoriesService } from './productCategories.service';

export function productCategoriesModule(ctx: TenantCtx) {
  return new ProductCategoriesService(new ProductCategoriesRepository(ctx.db, ctx.tenantId));
}
