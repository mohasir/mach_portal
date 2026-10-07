import { and, eq, isNull, ne, type SQL } from 'drizzle-orm';
import { QUOTE_STAGE } from '@repo/schemas';
import { events, quotes } from '../../db/schema';

// Single definition of "this staff assignment keeps them busy that day", shared by the
// availability picker and the reschedule conflict check so they never disagree. Availability
// is per day: events have no end time. Expects the query to join eventStaff → events → quotes.
export const staffBusyOnDate = (date: string): SQL =>
  and(
    eq(events.eventDate, date),
    isNull(quotes.archivedAt),
    ne(quotes.stageId, QUOTE_STAGE.CANCELLED),
  )!;
