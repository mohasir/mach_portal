import type { TenantRunner } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { ConfigRepository } from '../config/config.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { QuotesRepository } from '../quotes/quotes.repository';
import { RescheduleReasonsRepository } from '../rescheduleReasons/rescheduleReasons.repository';
import { StaffRepository } from '../staff/staff.repository';
import { EventsRepository } from './events.repository';
import { EventsService, PaymentAttachmentUploader } from './events.service';

// Event, payment, attachment, staff, reason and catalog ids from `input` are resolved inside the
// tenant (EventsService and these repositories) before anything references them.
export function eventsModule(ctx: TenantCtx) {
  return new EventsService(
    new EventsRepository(ctx.db, ctx.tenantId),
    new QuotesRepository(ctx.db, ctx.tenantId),
    new ConfigRepository(ctx.db, ctx.tenantId),
    new RescheduleReasonsRepository(ctx.db, ctx.tenantId),
    new NotificationsRepository(ctx.db, ctx.tenantId),
    new StaffRepository(ctx.db, ctx.tenantId),
    ctx.afterCommit,
  );
}

// No request transaction: each phase of the upload opens its own short one through `runInTenant`.
export function paymentAttachmentsModule(runInTenant: TenantRunner, tenantId: string) {
  return new PaymentAttachmentUploader(runInTenant, (tx) => new EventsRepository(tx, tenantId));
}
