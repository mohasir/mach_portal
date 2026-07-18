import { and, asc, desc, count, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import {
  QUOTE_STAGE,
  type AssignStaffInput,
  type EventsCalendarQuery,
  type EventsListQuery,
  type RemoveStaffInput,
  type UpdateEventPaymentInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import {
  clients,
  events,
  eventStaff,
  eventTypes,
  quoteLineOptions,
  quoteLines,
  quotes,
  staff,
} from '../../db/schema';
import { resolvePagination } from '../../lib/utils/pagination';
import { publicQuoteLineColumns, publicQuoteLineOptionColumns } from '../quotes/quotes.resource';
import { publicEventColumns } from './events.resource';

const sortColumns = {
  eventDate: events.eventDate,
  totalAmount: events.totalAmount,
  createdAt: events.createdAt,
} as const;

export class EventsRepository {
  constructor(private db: Database) {}

  private baseSelect() {
    return this.db
      .select({
        ...publicEventColumns,
        clientName: clients.name,
        eventTypeName: eventTypes.name,
        quoteNumber: quotes.number,
        quoteCancelled: sql<boolean>`${quotes.stageId} = ${QUOTE_STAGE.CANCELLED}`,
      })
      .from(events)
      .innerJoin(clients, eq(events.clientId, clients.id))
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .leftJoin(eventTypes, eq(events.eventTypeId, eventTypes.id));
  }

  async findPaginated(query: EventsListQuery) {
    const { search, sortBy, sortDir, clientId } = query;
    const where = and(
      search ? ilike(clients.name, `%${search}%`) : undefined,
      clientId ? eq(events.clientId, clientId) : undefined,
    );
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.baseSelect().where(where).orderBy(orderBy).limit(limit).offset(offset);

    const total = paginate ? await this.countAll(where) : items.length;
    return { items, total, paginate, page, pageSize };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db
      .select({ value: count() })
      .from(events)
      .innerJoin(clients, eq(events.clientId, clients.id))
      .where(where);
    return row?.value ?? 0;
  }

  findCalendarRange(query: EventsCalendarQuery) {
    return this.baseSelect().where(
      and(
        sql`extract(month from ${events.eventDate}) = ${query.month}`,
        sql`extract(year from ${events.eventDate}) = ${query.year}`,
      ),
    );
  }

  async findById(id: string) {
    const [eventRow] = await this.baseSelect().where(eq(events.id, id)).limit(1);
    if (!eventRow) return undefined;

    const lineRows = await this.db
      .select(publicQuoteLineColumns)
      .from(quoteLines)
      .where(eq(quoteLines.quoteId, eventRow.quoteId));

    const lineIds = lineRows.map((l) => l.id);
    const optionRows = lineIds.length
      ? await this.db
          .select(publicQuoteLineOptionColumns)
          .from(quoteLineOptions)
          .where(inArray(quoteLineOptions.quoteLineId, lineIds))
      : [];

    const staffRows = await this.findStaff(id);

    return { eventRow, lineRows, optionRows, staffRows };
  }

  findStaff(eventId: string) {
    return this.db
      .select({
        id: eventStaff.id,
        staffId: eventStaff.staffId,
        staffName: staff.name,
        role: eventStaff.role,
        assignedAt: eventStaff.assignedAt,
      })
      .from(eventStaff)
      .innerJoin(staff, eq(eventStaff.staffId, staff.id))
      .where(eq(eventStaff.eventId, eventId));
  }

  updatePayment(id: string, data: UpdateEventPaymentInput) {
    return this.db
      .update(events)
      .set(data)
      .where(eq(events.id, id))
      .returning(publicEventColumns)
      .then((r) => r[0]);
  }

  markCompleted(id: string) {
    return this.db
      .update(events)
      .set({ completedAt: new Date() })
      .where(eq(events.id, id))
      .returning(publicEventColumns)
      .then((r) => r[0]);
  }

  async isStaffAssigned(eventId: string, staffId: string) {
    const [row] = await this.db
      .select({ id: eventStaff.id })
      .from(eventStaff)
      .where(and(eq(eventStaff.eventId, eventId), eq(eventStaff.staffId, staffId)))
      .limit(1);
    return !!row;
  }

  assignStaff(data: AssignStaffInput) {
    return this.db
      .insert(eventStaff)
      .values(data)
      .returning()
      .then((r) => r[0]);
  }

  removeStaff(data: RemoveStaffInput) {
    return this.db
      .delete(eventStaff)
      .where(and(eq(eventStaff.eventId, data.eventId), eq(eventStaff.staffId, data.staffId)))
      .returning({ id: eventStaff.id })
      .then((r) => r[0]);
  }
}
