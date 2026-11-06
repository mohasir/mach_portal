import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

// Notification ids from `input` are resolved inside the tenant before a read is recorded.
export function notificationsModule(ctx: TenantCtx) {
  return new NotificationsService(new NotificationsRepository(db, ctx.tenantId));
}
