import { and, asc, count, desc, eq, ilike, inArray, ne, sql, type SQL } from 'drizzle-orm';
import type {
  ChargeTypesListQuery,
  CreateChargeTypeInput,
  UpdateChargeTypeInput,
} from '@repo/schemas';
import type { Executor } from '../../db';
import { chargeTypes } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { resolvePagination } from '../../lib/utils/pagination';
import { containsPattern } from '../../lib/utils/search';
import { publicChargeTypeColumns } from './chargeTypes.resource';

const sortColumns = {
  name: chargeTypes.name,
  kind: chargeTypes.kind,
  isActive: chargeTypes.isActive,
  sortOrder: chargeTypes.sortOrder,
} as const;

export class ChargeTypesRepository {
  constructor(
    private db: Executor,
    private tenantId: string,
  ) {}

  async findPaginated(query: ChargeTypesListQuery) {
    const { search, sortBy, sortDir, isActive } = query;
    const where = and(
      tenantEq(chargeTypes, this.tenantId),
      search ? ilike(chargeTypes.name, containsPattern(search)) : undefined,
      isActive === undefined ? undefined : eq(chargeTypes.isActive, isActive),
    );
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.db
      .select(publicChargeTypeColumns)
      .from(chargeTypes)
      .where(where)
      .orderBy(orderBy, asc(chargeTypes.sortOrder), asc(chargeTypes.name))
      .limit(limit)
      .offset(offset);

    const total = paginate ? await this.countAll(where) : items.length;
    return { items, total, paginate, page, pageSize };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db.select({ value: count() }).from(chargeTypes).where(where);
    return row?.value ?? 0;
  }

  findActive() {
    return this.db
      .select(publicChargeTypeColumns)
      .from(chargeTypes)
      .where(and(tenantEq(chargeTypes, this.tenantId), eq(chargeTypes.isActive, true)))
      .orderBy(asc(chargeTypes.sortOrder), asc(chargeTypes.name));
  }

  findById(id: string) {
    return this.db
      .select(publicChargeTypeColumns)
      .from(chargeTypes)
      .where(and(eq(chargeTypes.id, id), tenantEq(chargeTypes, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  // Active or not: the caller decides what an inactive type means for it.
  findByIds(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return Promise.resolve([]);
    return this.db
      .select(publicChargeTypeColumns)
      .from(chargeTypes)
      .where(and(inArray(chargeTypes.id, uniqueIds), tenantEq(chargeTypes, this.tenantId)));
  }

  // Case-insensitive, like the unique index on (tenant_id, lower(name)).
  findByName(name: string, excludeId?: string): Promise<{ id: string } | undefined> {
    return this.db
      .select({ id: chargeTypes.id })
      .from(chargeTypes)
      .where(
        and(
          sql`lower(${chargeTypes.name}) = lower(${name})`,
          tenantEq(chargeTypes, this.tenantId),
          excludeId ? ne(chargeTypes.id, excludeId) : undefined,
        ),
      )
      .limit(1)
      .then((r) => r[0]);
  }

  async create(data: CreateChargeTypeInput) {
    const [last] = await this.db
      .select({ value: sql<number>`coalesce(max(${chargeTypes.sortOrder}), -1)::int` })
      .from(chargeTypes)
      .where(tenantEq(chargeTypes, this.tenantId));
    const [row] = await this.db
      .insert(chargeTypes)
      .values({
        name: data.name,
        kind: data.kind,
        defaultValue: data.defaultValue,
        sortOrder: (last?.value ?? -1) + 1,
        tenantId: this.tenantId,
      })
      .returning(publicChargeTypeColumns);
    return row!;
  }

  updateById(id: string, data: UpdateChargeTypeInput) {
    return this.db
      .update(chargeTypes)
      .set({ name: data.name, kind: data.kind, defaultValue: data.defaultValue })
      .where(and(eq(chargeTypes.id, id), tenantEq(chargeTypes, this.tenantId)))
      .returning(publicChargeTypeColumns)
      .then((r) => r[0]);
  }

  setActive(id: string, isActive: boolean) {
    return this.db
      .update(chargeTypes)
      .set({ isActive })
      .where(and(eq(chargeTypes.id, id), tenantEq(chargeTypes, this.tenantId)))
      .returning(publicChargeTypeColumns)
      .then((r) => r[0]);
  }
}
