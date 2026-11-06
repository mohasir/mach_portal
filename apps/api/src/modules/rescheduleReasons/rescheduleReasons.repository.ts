import { and, asc, count, desc, eq, ilike, ne, sql, type SQL } from 'drizzle-orm';
import type {
  CreateRescheduleReasonInput,
  RescheduleReasonsListQuery,
  UpdateRescheduleReasonInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import { rescheduleReasons } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { resolvePagination } from '../../lib/utils/pagination';
import { publicRescheduleReasonColumns } from './rescheduleReasons.resource';
import { containsPattern } from '../../lib/utils/search';

const sortColumns = {
  name: rescheduleReasons.name,
  isActive: rescheduleReasons.isActive,
  sortOrder: rescheduleReasons.sortOrder,
} as const;

export class RescheduleReasonsRepository {
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}

  async findPaginated(query: RescheduleReasonsListQuery) {
    const { search, sortBy, sortDir, isActive } = query;
    const where = and(
      tenantEq(rescheduleReasons, this.tenantId),
      search ? ilike(rescheduleReasons.name, containsPattern(search)) : undefined,
      isActive === undefined ? undefined : eq(rescheduleReasons.isActive, isActive),
    );
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.db
      .select(publicRescheduleReasonColumns)
      .from(rescheduleReasons)
      .where(where)
      .orderBy(orderBy, asc(rescheduleReasons.name))
      .limit(limit)
      .offset(offset);

    const total = paginate ? await this.countAll(where) : items.length;
    return { items, total, paginate, page, pageSize };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db.select({ value: count() }).from(rescheduleReasons).where(where);
    return row?.value ?? 0;
  }

  findById(id: string) {
    return this.db
      .select(publicRescheduleReasonColumns)
      .from(rescheduleReasons)
      .where(and(eq(rescheduleReasons.id, id), tenantEq(rescheduleReasons, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  findByName(name: string, excludeId?: string) {
    return this.db
      .select({ id: rescheduleReasons.id })
      .from(rescheduleReasons)
      .where(
        and(
          eq(rescheduleReasons.name, name),
          tenantEq(rescheduleReasons, this.tenantId),
          excludeId ? ne(rescheduleReasons.id, excludeId) : undefined,
        ),
      )
      .limit(1)
      .then((r) => r[0]);
  }

  async getMaxSortOrder() {
    const [row] = await this.db
      .select({ value: sql<number>`coalesce(max(${rescheduleReasons.sortOrder}), -1)::int` })
      .from(rescheduleReasons)
      .where(tenantEq(rescheduleReasons, this.tenantId));
    return row?.value ?? -1;
  }

  create(data: CreateRescheduleReasonInput & { sortOrder: number }) {
    return this.db
      .insert(rescheduleReasons)
      .values({ ...data, tenantId: this.tenantId })
      .returning(publicRescheduleReasonColumns)
      .then((r) => r[0]!);
  }

  updateById(id: string, data: UpdateRescheduleReasonInput) {
    return this.db
      .update(rescheduleReasons)
      .set(data)
      .where(and(eq(rescheduleReasons.id, id), tenantEq(rescheduleReasons, this.tenantId)))
      .returning(publicRescheduleReasonColumns)
      .then((r) => r[0]);
  }

  setActive(id: string, isActive: boolean) {
    return this.db
      .update(rescheduleReasons)
      .set({ isActive })
      .where(and(eq(rescheduleReasons.id, id), tenantEq(rescheduleReasons, this.tenantId)))
      .returning(publicRescheduleReasonColumns)
      .then((r) => r[0]);
  }
}
