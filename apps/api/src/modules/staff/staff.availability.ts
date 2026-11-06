import { and, eq, isNull, ne, type SQL } from 'drizzle-orm';
import { QUOTE_STAGE } from '@repo/schemas';
import { events, eventStaff, quotes } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';

// Single definition of "this staff assignment keeps them busy that day", shared by the
// availability picker and the reschedule conflict check so they never disagree. Availability
// is per day: events have no end time. Expects the query to join eventStaff → events → quotes;
// all three tables are tenant-scoped, so each is filtered here (joins do not carry the tenant).
export const staffBusyOnDate = (date: string, tenantId: string): SQL =>
  and(
    tenantEq(eventStaff, tenantId),
    tenantEq(events, tenantId),
    tenantEq(quotes, tenantId),
    eq(events.eventDate, date),
    isNull(quotes.archivedAt),
    ne(quotes.stageId, QUOTE_STAGE.CANCELLED),
  )!;
