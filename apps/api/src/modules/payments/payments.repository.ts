import { and, asc, count, desc, eq, gte, ilike, isNull, lte, sql, type SQL } from 'drizzle-orm';
import type { PaymentsIncomeQuery, PaymentsListQuery } from '@repo/schemas';
import type { Database } from '../../db';
import { clients, events, eventPayments, eventTypes, quotes, user } from '../../db/schema';
import { resolvePagination } from '../../lib/utils/pagination';

const sortColumns = {
  paidAt: eventPayments.paidAt,
  amount: eventPayments.amount,
  createdAt: eventPayments.createdAt,
} as const;

export class PaymentsRepository {
  constructor(private db: Database) {}

  private baseSelect() {
    return this.db
      .select({
        id: eventPayments.id,
        eventId: eventPayments.eventId,
        eventDate: events.eventDate,
        clientName: clients.name,
        eventTypeName: eventTypes.name,
        method: eventPayments.method,
        amount: eventPayments.amount,
        paidAt: eventPayments.paidAt,
        reference: eventPayments.reference,
        createdByName: user.name,
      })
      .from(eventPayments)
      .innerJoin(events, eq(eventPayments.eventId, events.id))
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .innerJoin(clients, eq(events.clientId, clients.id))
      .leftJoin(eventTypes, eq(events.eventTypeId, eventTypes.id))
      .leftJoin(user, eq(eventPayments.createdById, user.id));
  }

  async findPaginated(query: PaymentsListQuery) {
    const { search, sortBy, sortDir, dateFrom, dateTo, clientId, eventTypeId, method } = query;

    const where = and(
      isNull(quotes.archivedAt),
      search ? ilike(clients.name, `%${search}%`) : undefined,
      dateFrom ? gte(eventPayments.paidAt, dateFrom) : undefined,
      dateTo ? lte(eventPayments.paidAt, dateTo) : undefined,
      clientId ? eq(events.clientId, clientId) : undefined,
      eventTypeId ? eq(events.eventTypeId, eventTypeId) : undefined,
      method ? eq(eventPayments.method, method) : undefined,
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
      .from(eventPayments)
      .innerJoin(events, eq(eventPayments.eventId, events.id))
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .innerJoin(clients, eq(events.clientId, clients.id))
      .where(where);
    return row?.value ?? 0;
  }

  findIncome(query: PaymentsIncomeQuery) {
    const { dateFrom, dateTo, groupBy } = query;

    const where = and(
      isNull(quotes.archivedAt),
      dateFrom ? gte(eventPayments.paidAt, dateFrom) : undefined,
      dateTo ? lte(eventPayments.paidAt, dateTo) : undefined,
    );

    return this.db
      .select({
        period:
          sql<string>`to_char(date_trunc(${groupBy}::text, ${eventPayments.paidAt}), 'YYYY-MM-DD')`
            .mapWith(String)
            .as('period'),
        totalAmount: sql<number>`coalesce(sum(${eventPayments.amount}), 0)::int`,
        count: count(),
      })
      .from(eventPayments)
      .innerJoin(events, eq(eventPayments.eventId, events.id))
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .where(where)
      .groupBy(sql`period`)
      .orderBy(sql`period`);
  }
}
