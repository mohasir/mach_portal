import { and, asc, count, desc, eq, ilike, ne, or, sql, type SQL } from 'drizzle-orm';
import type { CreateUnitInput, UnitsOfMeasureListQuery, UpdateUnitInput } from '@repo/schemas';
import type { Executor } from '../../db';
import { products, quoteLines, unitsOfMeasure } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { resolvePagination } from '../../lib/utils/pagination';
import { containsPattern } from '../../lib/utils/search';
import { publicUnitColumns } from './unitsOfMeasure.resource';

const sortColumns = {
  name: unitsOfMeasure.name,
  code: unitsOfMeasure.code,
  dimension: unitsOfMeasure.dimension,
  isActive: unitsOfMeasure.isActive,
  sortOrder: unitsOfMeasure.sortOrder,
} as const;

export class UnitsOfMeasureRepository {
  constructor(
    private db: Executor,
    private tenantId: string,
  ) {}

  // Built with eq()/and() so the columns stay table-qualified inside the correlated subquery.
  private usedByProduct(activeOnly: boolean) {
    const match = and(
      eq(products.uomId, unitsOfMeasure.id),
      tenantEq(products, this.tenantId),
      activeOnly ? eq(products.isActive, true) : undefined,
    );
    return sql<boolean>`exists (select 1 from ${products} where ${match})`;
  }

  private usedByQuoteLine() {
    const match = and(eq(quoteLines.uomId, unitsOfMeasure.id), tenantEq(quoteLines, this.tenantId));
    return sql<boolean>`exists (select 1 from ${quoteLines} where ${match})`;
  }

  private get columns() {
    return {
      ...publicUnitColumns,
      isUsed: sql<boolean>`(${this.usedByProduct(false)} or ${this.usedByQuoteLine()})`,
    };
  }

  async findPaginated(query: UnitsOfMeasureListQuery) {
    const { search, sortBy, sortDir, dimension, isActive } = query;
    const pattern = search ? containsPattern(search) : undefined;
    const where = and(
      tenantEq(unitsOfMeasure, this.tenantId),
      pattern
        ? or(
            ilike(unitsOfMeasure.name, pattern),
            ilike(unitsOfMeasure.pluralName, pattern),
            ilike(unitsOfMeasure.code, pattern),
          )
        : undefined,
      dimension ? eq(unitsOfMeasure.dimension, dimension) : undefined,
      isActive === undefined ? undefined : eq(unitsOfMeasure.isActive, isActive),
    );
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.db
      .select(this.columns)
      .from(unitsOfMeasure)
      .where(where)
      .orderBy(orderBy, asc(unitsOfMeasure.sortOrder), asc(unitsOfMeasure.name))
      .limit(limit)
      .offset(offset);

    const total = paginate ? await this.countAll(where) : items.length;
    return { items, total, paginate, page, pageSize };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db.select({ value: count() }).from(unitsOfMeasure).where(where);
    return row?.value ?? 0;
  }

  findActive() {
    return this.db
      .select(this.columns)
      .from(unitsOfMeasure)
      .where(and(tenantEq(unitsOfMeasure, this.tenantId), eq(unitsOfMeasure.isActive, true)))
      .orderBy(asc(unitsOfMeasure.sortOrder), asc(unitsOfMeasure.name));
  }

  findById(id: string) {
    return this.db
      .select(this.columns)
      .from(unitsOfMeasure)
      .where(and(eq(unitsOfMeasure.id, id), tenantEq(unitsOfMeasure, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  // Case-insensitive: "KG" and "kg" would read as the same abbreviation.
  findByCode(code: string, excludeId?: string): Promise<{ id: string } | undefined> {
    return this.db
      .select({ id: unitsOfMeasure.id })
      .from(unitsOfMeasure)
      .where(
        and(
          sql`lower(${unitsOfMeasure.code}) = lower(${code})`,
          tenantEq(unitsOfMeasure, this.tenantId),
          excludeId ? ne(unitsOfMeasure.id, excludeId) : undefined,
        ),
      )
      .limit(1)
      .then((r) => r[0]);
  }

  async isUsed(id: string) {
    return (await this.isReferencedByProduct(id, false)) || (await this.isUsedByQuoteLine(id));
  }

  // Deactivating is blocked by an active product or by any quote line: a line keeps its unit
  // for good, even after the product that spawned it changed unit.
  async blocksDeactivation(id: string) {
    return (await this.isReferencedByProduct(id, true)) || (await this.isUsedByQuoteLine(id));
  }

  private isReferencedByProduct(id: string, activeOnly: boolean) {
    return this.db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.uomId, id),
          tenantEq(products, this.tenantId),
          activeOnly ? eq(products.isActive, true) : undefined,
        ),
      )
      .limit(1)
      .then((r) => r.length > 0);
  }

  private isUsedByQuoteLine(id: string) {
    return this.db
      .select({ id: quoteLines.id })
      .from(quoteLines)
      .where(and(eq(quoteLines.uomId, id), tenantEq(quoteLines, this.tenantId)))
      .limit(1)
      .then((r) => r.length > 0);
  }

  async create(data: CreateUnitInput) {
    const [last] = await this.db
      .select({ value: sql<number>`coalesce(max(${unitsOfMeasure.sortOrder}), -1)::int` })
      .from(unitsOfMeasure)
      .where(tenantEq(unitsOfMeasure, this.tenantId));
    const [row] = await this.db
      .insert(unitsOfMeasure)
      .values({
        name: data.name,
        pluralName: data.pluralName,
        code: data.code,
        dimension: data.dimension,
        factor: data.factor,
        isBase: false,
        isSystem: false,
        sortOrder: (last?.value ?? -1) + 1,
        tenantId: this.tenantId,
      })
      .returning({ id: unitsOfMeasure.id });
    return (await this.findById(row!.id))!;
  }

  async updateById(id: string, data: UpdateUnitInput) {
    const [row] = await this.db
      .update(unitsOfMeasure)
      .set({
        name: data.name,
        pluralName: data.pluralName,
        code: data.code,
        dimension: data.dimension,
        factor: data.factor,
      })
      .where(and(eq(unitsOfMeasure.id, id), tenantEq(unitsOfMeasure, this.tenantId)))
      .returning({ id: unitsOfMeasure.id });
    return row ? this.findById(row.id) : undefined;
  }

  async setActive(id: string, isActive: boolean) {
    const [row] = await this.db
      .update(unitsOfMeasure)
      .set({ isActive })
      .where(and(eq(unitsOfMeasure.id, id), tenantEq(unitsOfMeasure, this.tenantId)))
      .returning({ id: unitsOfMeasure.id });
    return row ? this.findById(row.id) : undefined;
  }
}
