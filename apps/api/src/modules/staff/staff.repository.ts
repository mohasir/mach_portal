import { and, asc, count, desc, eq, ilike, notInArray, or, type SQL } from 'drizzle-orm';
import type { CreateStaffInput, StaffListQuery, UpdateStaffInput } from '@repo/schemas';
import type { Database } from '../../db';
import { events, eventStaff, quotes, staff } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { resolvePagination } from '../../lib/utils/pagination';
import { publicStaffColumns } from './staff.resource';
import { staffBusyOnDate } from './staff.availability';
import { containsPattern } from '../../lib/utils/search';

const sortColumns = {
  name: staff.name,
  isActive: staff.isActive,
  createdAt: staff.createdAt,
} as const;

export class StaffRepository {
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}

  async findPaginated(query: StaffListQuery) {
    const { search, sortBy, sortDir } = query;
    const searchFilter = search
      ? or(
          ilike(staff.name, containsPattern(search)),
          ilike(staff.email, containsPattern(search)),
          ilike(staff.phone, containsPattern(search)),
        )
      : undefined;
    const where = and(tenantEq(staff, this.tenantId), searchFilter);
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.db
      .select(publicStaffColumns)
      .from(staff)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const total = paginate ? await this.countAll(where) : items.length;
    return { items, total, paginate, page, pageSize };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db.select({ value: count() }).from(staff).where(where);
    return row?.value ?? 0;
  }

  findById(id: string) {
    return this.db
      .select(publicStaffColumns)
      .from(staff)
      .where(and(eq(staff.id, id), tenantEq(staff, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  create(data: CreateStaffInput) {
    // insert ... returning always yields the inserted row.
    return this.db
      .insert(staff)
      .values({ ...data, tenantId: this.tenantId })
      .returning(publicStaffColumns)
      .then((r) => r[0]!);
  }

  updateById(id: string, data: UpdateStaffInput) {
    return this.db
      .update(staff)
      .set(data)
      .where(and(eq(staff.id, id), tenantEq(staff, this.tenantId)))
      .returning(publicStaffColumns)
      .then((r) => r[0]);
  }

  deleteById(id: string) {
    return this.db
      .delete(staff)
      .where(and(eq(staff.id, id), tenantEq(staff, this.tenantId)))
      .returning({ id: staff.id })
      .then((r) => r[0]);
  }

  findAvailable(date: string) {
    const assignedThatDay = this.db
      .select({ staffId: eventStaff.staffId })
      .from(eventStaff)
      .innerJoin(events, eq(eventStaff.eventId, events.id))
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .where(staffBusyOnDate(date, this.tenantId));

    return this.db
      .select(publicStaffColumns)
      .from(staff)
      .where(
        and(
          tenantEq(staff, this.tenantId),
          eq(staff.isActive, true),
          notInArray(staff.id, assignedThatDay),
        ),
      );
  }
}
