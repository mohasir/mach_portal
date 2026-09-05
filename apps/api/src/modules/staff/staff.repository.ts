import { and, asc, count, desc, eq, ilike, isNull, notInArray, or, type SQL } from 'drizzle-orm';
import type { CreateStaffInput, StaffListQuery, UpdateStaffInput } from '@repo/schemas';
import type { Database } from '../../db';
import { events, eventStaff, quotes, staff } from '../../db/schema';
import { resolvePagination } from '../../lib/utils/pagination';
import { publicStaffColumns } from './staff.resource';

const sortColumns = {
  name: staff.name,
  isActive: staff.isActive,
  createdAt: staff.createdAt,
} as const;

export class StaffRepository {
  constructor(private db: Database) {}

  async findPaginated(query: StaffListQuery) {
    const { search, sortBy, sortDir } = query;
    const where = search
      ? or(
          ilike(staff.name, `%${search}%`),
          ilike(staff.email, `%${search}%`),
          ilike(staff.phone, `%${search}%`),
        )
      : undefined;
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

  create(data: CreateStaffInput) {
    // insert ... returning always yields the inserted row.
    return this.db
      .insert(staff)
      .values(data)
      .returning(publicStaffColumns)
      .then((r) => r[0]!);
  }

  updateById(id: string, data: UpdateStaffInput) {
    return this.db
      .update(staff)
      .set(data)
      .where(eq(staff.id, id))
      .returning(publicStaffColumns)
      .then((r) => r[0]);
  }

  deleteById(id: string) {
    return this.db
      .delete(staff)
      .where(eq(staff.id, id))
      .returning({ id: staff.id })
      .then((r) => r[0]);
  }

  findAvailable(date: string) {
    const assignedThatDay = this.db
      .select({ staffId: eventStaff.staffId })
      .from(eventStaff)
      .innerJoin(events, eq(eventStaff.eventId, events.id))
      .innerJoin(quotes, eq(events.quoteId, quotes.id))
      .where(and(eq(events.eventDate, date), isNull(quotes.archivedAt)));

    return this.db
      .select(publicStaffColumns)
      .from(staff)
      .where(and(eq(staff.isActive, true), notInArray(staff.id, assignedThatDay)));
  }
}
