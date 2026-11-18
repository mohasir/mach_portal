import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import { isToggleable, resolveFeatures } from '@repo/guards';
import { DEFAULT_CATALOG_KIND, type ConsoleOrganizationListQuery } from '@repo/schemas';
import type { Database } from '../../../db';
import { organization, tenantFeatures, tenantProfile } from '../../../db/schema';
import { resolvePagination } from '../../../lib/utils/pagination';
import { containsPattern } from '../../../lib/utils/search';
import type { OrganizationRow } from './organizations.resource';

const sortColumns = {
  name: organization.name,
  createdAt: organization.createdAt,
} as const;

const columns = {
  id: organization.id,
  slug: organization.slug,
  name: organization.name,
  catalogKind: sql<
    OrganizationRow['catalogKind']
  >`coalesce(${tenantProfile.catalogKind}, ${DEFAULT_CATALOG_KIND})`,
  createdAt: organization.createdAt,
};

export type FeatureSummary = { activeFeatureCount: number; nextExpiry: Date | null };

// Runs on the platform client: it reads every tenant's rows, so there is no tenant filter.
export class OrganizationsRepository {
  constructor(private db: Database) {}

  async findPaginated(query: ConsoleOrganizationListQuery) {
    const { search, sortBy, sortDir, catalogKind } = query;
    const where = and(
      search
        ? or(
            ilike(organization.name, containsPattern(search)),
            ilike(organization.slug, containsPattern(search)),
          )
        : undefined,
      catalogKind
        ? sql`coalesce(${tenantProfile.catalogKind}, ${DEFAULT_CATALOG_KIND}) = ${catalogKind}`
        : undefined,
    );
    const direction = sortDir === 'asc' ? asc : desc;
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.db
      .select(columns)
      .from(organization)
      .leftJoin(tenantProfile, eq(tenantProfile.tenantId, organization.id))
      .where(where)
      .orderBy(direction(sortColumns[sortBy]), asc(organization.id))
      .limit(limit)
      .offset(offset);

    const total = paginate ? await this.countAll(where) : items.length;
    return { items, total, paginate, page, pageSize };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db
      .select({ value: count() })
      .from(organization)
      .leftJoin(tenantProfile, eq(tenantProfile.tenantId, organization.id))
      .where(where);
    return row?.value ?? 0;
  }

  findById(id: string) {
    return this.db
      .select(columns)
      .from(organization)
      .leftJoin(tenantProfile, eq(tenantProfile.tenantId, organization.id))
      .where(eq(organization.id, id))
      .limit(1)
      .then((r) => r[0]);
  }

  async featureSummaries(tenantIds: string[]): Promise<Map<string, FeatureSummary>> {
    const summaries = new Map<string, FeatureSummary>();
    if (tenantIds.length === 0) return summaries;
    const rows = await this.db
      .select({
        tenantId: tenantFeatures.tenantId,
        featureKey: tenantFeatures.featureKey,
        enabled: tenantFeatures.enabled,
        expiresAt: tenantFeatures.expiresAt,
      })
      .from(tenantFeatures)
      .where(inArray(tenantFeatures.tenantId, tenantIds));

    const now = new Date();
    for (const id of tenantIds) {
      const own = rows.filter((r) => r.tenantId === id);
      const active = resolveFeatures(own, now);
      const live = own.filter((r) => active.has(r.featureKey) && isToggleable(r.featureKey));
      const expiries = live.flatMap((r) => (r.expiresAt ? [r.expiresAt] : []));
      summaries.set(id, {
        activeFeatureCount: live.length,
        nextExpiry: expiries.length
          ? new Date(Math.min(...expiries.map((d) => d.getTime())))
          : null,
      });
    }
    return summaries;
  }
}
