import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { QUOTE_STAGE } from '@repo/schemas';
import type { Database } from '../../db';
import { events, eventPayments, quotes, quoteLines, products } from '../../db/schema';

export class DashboardRepository {
  constructor(private db: Database) {}

  async countEvents(month: number, year: number) {
    const [row] = await this.db
      .select({ value: count() })
      .from(events)
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .where(
        and(
          isNull(quotes.archivedAt),
          sql`extract(month from ${events.eventDate}) = ${month}`,
          sql`extract(year from ${events.eventDate}) = ${year}`,
        ),
      );
    return row?.value ?? 0;
  }

  async sumRevenue(month: number, year: number) {
    const [row] = await this.db
      .select({ value: sql<number>`coalesce(sum(${eventPayments.amount}), 0)::int` })
      .from(eventPayments)
      .innerJoin(events, eq(eventPayments.eventId, events.id))
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .where(
        and(
          isNull(quotes.archivedAt),
          sql`extract(month from ${eventPayments.paidAt}) = ${month}`,
          sql`extract(year from ${eventPayments.paidAt}) = ${year}`,
        ),
      );
    return row?.value ?? 0;
  }

  quotesStageCounts(month: number, year: number) {
    return this.db
      .select({ stageId: quotes.stageId, value: count() })
      .from(quotes)
      .where(
        and(
          isNull(quotes.archivedAt),
          sql`extract(month from ${quotes.createdAt}) = ${month}`,
          sql`extract(year from ${quotes.createdAt}) = ${year}`,
        ),
      )
      .groupBy(quotes.stageId);
  }

  quotesByMonth(year: number) {
    return this.db
      .select({
        month: sql<number>`extract(month from ${quotes.createdAt})::int`,
        value: count(),
      })
      .from(quotes)
      .where(and(isNull(quotes.archivedAt), sql`extract(year from ${quotes.createdAt}) = ${year}`))
      .groupBy(sql`extract(month from ${quotes.createdAt})`)
      .orderBy(sql`extract(month from ${quotes.createdAt})`);
  }

  topProducts(month: number, year: number, limit: number) {
    return this.db
      .select({
        productId: products.id,
        productName: products.name,
        value: count(),
      })
      .from(quoteLines)
      .innerJoin(quotes, eq(quoteLines.quoteId, quotes.id))
      .innerJoin(products, eq(quoteLines.productId, products.id))
      .where(
        and(
          eq(quotes.stageId, QUOTE_STAGE.CONFIRMED),
          isNull(quotes.archivedAt),
          sql`extract(month from ${quotes.eventDate}) = ${month}`,
          sql`extract(year from ${quotes.eventDate}) = ${year}`,
        ),
      )
      .groupBy(products.id, products.name)
      .orderBy(desc(count()))
      .limit(limit);
  }

  async topProductsTotal(month: number, year: number) {
    const [row] = await this.db
      .select({ value: count() })
      .from(quoteLines)
      .innerJoin(quotes, eq(quoteLines.quoteId, quotes.id))
      .where(
        and(
          eq(quotes.stageId, QUOTE_STAGE.CONFIRMED),
          isNull(quotes.archivedAt),
          sql`extract(month from ${quotes.eventDate}) = ${month}`,
          sql`extract(year from ${quotes.eventDate}) = ${year}`,
        ),
      );
    return row?.value ?? 0;
  }
}
