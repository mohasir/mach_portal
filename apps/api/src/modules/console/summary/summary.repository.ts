import { asc, count, eq } from 'drizzle-orm';
import type { Database } from '../../../db';
import {
  clients,
  events,
  organization,
  products,
  quoteStages,
  quotes,
  tenantFeatures,
} from '../../../db/schema';

// Runs on the platform client, which bypasses RLS: per-organization counts filter explicitly.
export class SummaryRepository {
  constructor(private db: Database) {}

  private async total(
    table: typeof organization | typeof products | typeof quotes | typeof events,
  ) {
    const [row] = await this.db.select({ n: count() }).from(table);
    return row?.n ?? 0;
  }

  async totals() {
    const [organizations, productCount, quoteCount, eventCount] = await Promise.all([
      this.total(organization),
      this.total(products),
      this.total(quotes),
      this.total(events),
    ]);
    return {
      organizations,
      products: productCount,
      quotes: quoteCount,
      events: eventCount,
    };
  }

  // Every enabled feature with an end date, soonest first; the caller keeps the ones about to end.
  enabledWithExpiry() {
    return this.db
      .select({
        organizationId: tenantFeatures.tenantId,
        organizationName: organization.name,
        featureKey: tenantFeatures.featureKey,
        expiresAt: tenantFeatures.expiresAt,
      })
      .from(tenantFeatures)
      .innerJoin(organization, eq(organization.id, tenantFeatures.tenantId))
      .where(eq(tenantFeatures.enabled, true))
      .orderBy(
        asc(tenantFeatures.expiresAt),
        asc(tenantFeatures.tenantId),
        asc(tenantFeatures.featureKey),
      );
  }

  async countsFor(organizationId: string) {
    const [[productRow], [clientRow], [eventRow], byStage] = await Promise.all([
      this.db.select({ n: count() }).from(products).where(eq(products.tenantId, organizationId)),
      this.db.select({ n: count() }).from(clients).where(eq(clients.tenantId, organizationId)),
      this.db.select({ n: count() }).from(events).where(eq(events.tenantId, organizationId)),
      this.db
        .select({ stageId: quoteStages.id, label: quoteStages.label, n: count() })
        .from(quotes)
        .innerJoin(quoteStages, eq(quoteStages.id, quotes.stageId))
        .where(eq(quotes.tenantId, organizationId))
        .groupBy(quoteStages.id, quoteStages.label, quoteStages.sortOrder)
        .orderBy(asc(quoteStages.sortOrder), asc(quoteStages.id)),
    ]);
    return {
      products: productRow?.n ?? 0,
      clients: clientRow?.n ?? 0,
      events: eventRow?.n ?? 0,
      quotesByStage: byStage,
    };
  }
}
