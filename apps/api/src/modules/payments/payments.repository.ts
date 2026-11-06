import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { PaymentsIncomeQuery, PaymentsListQuery } from '@repo/schemas';
import type { Database } from '../../db';
import { clients, events, eventPayments, eventTypes, quotes, user } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { resolvePagination } from '../../lib/utils/pagination';
import { containsPattern } from '../../lib/utils/search';

const sortColumns = {
  paidAt: eventPayments.paidAt,
  amount: eventPayments.amount,
  createdAt: eventPayments.createdAt,
} as const;

export class PaymentsRepository {
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}

  // Every joined tenant table is matched inside its own ON clause, so a payment whose event,
  // quote or client belongs to another tenant is dropped instead of leaking.
  private eventJoin() {
    return and(eq(eventPayments.eventId, events.id), tenantEq(events, this.tenantId));
  }

  private quoteJoin() {
    return and(eq(events.quoteId, quotes.id), tenantEq(quotes, this.tenantId));
  }

  private clientJoin() {
    return and(eq(events.clientId, clients.id), tenantEq(clients, this.tenantId));
  }

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
      .innerJoin(events, this.eventJoin())
      .innerJoin(quotes, this.quoteJoin())
      .innerJoin(clients, this.clientJoin())
      .leftJoin(
        eventTypes,
        and(eq(events.eventTypeId, eventTypes.id), tenantEq(eventTypes, this.tenantId)),
      )
      .leftJoin(user, eq(eventPayments.createdById, user.id));
  }

  async findPaginated(query: PaymentsListQuery) {
    const { search, sortBy, sortDir, dateFrom, dateTo, clientIds, eventTypeIds, methods } = query;

    const where = and(
      tenantEq(eventPayments, this.tenantId),
      isNull(quotes.archivedAt),
      search ? ilike(clients.name, containsPattern(search)) : undefined,
      dateFrom ? gte(eventPayments.paidAt, dateFrom) : undefined,
      dateTo ? lte(eventPayments.paidAt, dateTo) : undefined,
      clientIds?.length ? inArray(events.clientId, clientIds) : undefined,
      eventTypeIds?.length ? inArray(events.eventTypeId, eventTypeIds) : undefined,
      methods?.length ? inArray(eventPayments.method, methods) : undefined,
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
      .innerJoin(events, this.eventJoin())
      .innerJoin(quotes, this.quoteJoin())
      .innerJoin(clients, this.clientJoin())
      .where(where);
    return row?.value ?? 0;
  }

  findIncome(query: PaymentsIncomeQuery) {
    const { dateFrom, dateTo, groupBy } = query;

    const where = and(
      tenantEq(eventPayments, this.tenantId),
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
      .innerJoin(events, this.eventJoin())
      .innerJoin(quotes, this.quoteJoin())
      .where(where)
      .groupBy(sql`period`)
      .orderBy(sql`period`);
  }
}
