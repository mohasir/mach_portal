import { and, asc, desc, count, eq, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import {
  QUOTE_STAGE,
  type AssignStaffInput,
  type EventsCalendarQuery,
  type EventsListQuery,
  type RegisterEventPaymentInput,
  type RemoveStaffInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import {
  clients,
  events,
  eventPayments,
  eventStaff,
  eventTypes,
  quoteLineOptions,
  quoteLines,
  quotes,
  staff,
  user,
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
    const paymentRows = await this.findPayments(id);

    return { eventRow, lineRows, optionRows, staffRows, paymentRows };
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

  findPayments(eventId: string) {
    return this.db
      .select({
        id: eventPayments.id,
        method: eventPayments.method,
        amount: eventPayments.amount,
        paidAt: eventPayments.paidAt,
        reference: eventPayments.reference,
        notes: eventPayments.notes,
        createdByName: user.name,
        createdAt: eventPayments.createdAt,
      })
      .from(eventPayments)
      .leftJoin(user, eq(eventPayments.createdById, user.id))
      .where(eq(eventPayments.eventId, eventId))
      .orderBy(desc(eventPayments.paidAt), desc(eventPayments.createdAt));
  }

  async registerPayment(
    eventId: string,
    data: RegisterEventPaymentInput,
    createdById: string | null,
  ) {
    return this.db.transaction(async (tx) => {
      const [event] = await tx
        .select({ totalAmount: events.totalAmount, depositAmount: quotes.depositAmount })
        .from(events)
        .innerJoin(quotes, eq(events.quoteId, quotes.id))
        .where(eq(events.id, eventId))
        .limit(1);
      if (!event) return undefined;

      const [sumRow] = await tx
        .select({ paidSoFar: sql<number>`coalesce(sum(${eventPayments.amount}), 0)::int` })
        .from(eventPayments)
        .where(eq(eventPayments.eventId, eventId));

      const totalPaid = (sumRow?.paidSoFar ?? 0) + data.amount;
      if (totalPaid > event.totalAmount) return 'exceeds-balance' as const;

      await tx.insert(eventPayments).values({ eventId, ...data, createdById });
      await tx
        .update(events)
        .set({
          depositPaid: totalPaid >= event.depositAmount,
          balancePaid: totalPaid >= event.totalAmount,
        })
        .where(eq(events.id, eventId));

      return 'ok' as const;
    });
  }

  markCompleted(id: string) {
    return this.db
      .update(events)
      .set({ completedAt: new Date() })
      .where(eq(events.id, id))
      .returning(publicEventColumns)
      .then((r) => r[0]);
  }

  async isCompleted(eventId: string) {
    const [row] = await this.db
      .select({ completedAt: events.completedAt })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    return !!row?.completedAt;
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
