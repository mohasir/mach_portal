import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { TemplatesRepository } from './templates.repository';
import { TemplatesService } from './templates.service';

export function templatesModule(ctx: TenantCtx) {
  return new TemplatesService(new TemplatesRepository(db, ctx.tenantId));
}
