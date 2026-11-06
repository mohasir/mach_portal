import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { QUOTE_STAGE } from '@repo/schemas';
import type { Database } from '../../db';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { events, eventPayments, quotes, quoteLines, products } from '../../db/schema';

export class DashboardRepository {
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}

  async countEvents(month: number, year: number) {
    const [row] = await this.db
      .select({ value: count() })
      .from(events)
      .innerJoin(quotes, and(eq(events.quoteId, quotes.id), tenantEq(quotes, this.tenantId)))
      .where(
        and(
          tenantEq(events, this.tenantId),
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
      .innerJoin(events, and(eq(eventPayments.eventId, events.id), tenantEq(events, this.tenantId)))
      .innerJoin(quotes, and(eq(events.quoteId, quotes.id), tenantEq(quotes, this.tenantId)))
      .where(
        and(
          tenantEq(eventPayments, this.tenantId),
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
          tenantEq(quotes, this.tenantId),
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
      .where(
        and(
          tenantEq(quotes, this.tenantId),
          isNull(quotes.archivedAt),
          sql`extract(year from ${quotes.createdAt}) = ${year}`,
        ),
      )
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
      .innerJoin(quotes, and(eq(quoteLines.quoteId, quotes.id), tenantEq(quotes, this.tenantId)))
      .innerJoin(
        products,
        and(eq(quoteLines.productId, products.id), tenantEq(products, this.tenantId)),
      )
      .where(
        and(
          tenantEq(quoteLines, this.tenantId),
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
      .innerJoin(quotes, and(eq(quoteLines.quoteId, quotes.id), tenantEq(quotes, this.tenantId)))
      .where(
        and(
          tenantEq(quoteLines, this.tenantId),
          eq(quotes.stageId, QUOTE_STAGE.CONFIRMED),
          isNull(quotes.archivedAt),
          sql`extract(month from ${quotes.eventDate}) = ${month}`,
          sql`extract(year from ${quotes.eventDate}) = ${year}`,
        ),
      );
    return row?.value ?? 0;
  }
}
