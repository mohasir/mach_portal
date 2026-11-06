import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { ConfigRepository } from '../config/config.repository';
import { NotificationsRepository } from '../notifications/notifications.repository';
import { QuotesRepository } from '../quotes/quotes.repository';
import { RescheduleReasonsRepository } from '../rescheduleReasons/rescheduleReasons.repository';
import { StaffRepository } from '../staff/staff.repository';
import { EventsRepository } from './events.repository';
import { EventsService } from './events.service';

// Event, payment, attachment, staff, reason and catalog ids from `input` are resolved inside the
// tenant (EventsService and these repositories) before anything references them.
export function eventsModuleFromTenant(tenantId: string) {
  return new EventsService(
    new EventsRepository(db, tenantId),
    new QuotesRepository(db, tenantId),
    new ConfigRepository(db, tenantId),
    new RescheduleReasonsRepository(db, tenantId),
    new NotificationsRepository(db, tenantId),
    new StaffRepository(db, tenantId),
  );
}

export function eventsModule(ctx: TenantCtx) {
  return eventsModuleFromTenant(ctx.tenantId);
}
