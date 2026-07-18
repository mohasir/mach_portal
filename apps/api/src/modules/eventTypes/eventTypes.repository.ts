import { asc, count, desc, eq, ilike, type SQL } from 'drizzle-orm';
import type {
  CreateEventTypeInput,
  EventTypesListQuery,
  UpdateEventTypeInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import { eventTypes } from '../../db/schema';
import { resolvePagination } from '../../lib/utils/pagination';
import { publicEventTypeColumns } from './eventTypes.resource';

const sortColumns = {
  name: eventTypes.name,
  isActive: eventTypes.isActive,
  sortOrder: eventTypes.sortOrder,
} as const;

export class EventTypesRepository {
  constructor(private db: Database) {}

  async findPaginated(query: EventTypesListQuery) {
    const { search, sortBy, sortDir } = query;
    const where = search ? ilike(eventTypes.name, `%${search}%`) : undefined;
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.db
      .select(publicEventTypeColumns)
      .from(eventTypes)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const total = paginate ? await this.countAll(where) : items.length;
    return { items, total, paginate, page, pageSize };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db.select({ value: count() }).from(eventTypes).where(where);
    return row?.value ?? 0;
  }

  findByName(name: string) {
    return this.db
      .select({ id: eventTypes.id })
      .from(eventTypes)
      .where(eq(eventTypes.name, name))
      .limit(1)
      .then((r) => r[0]);
  }

  create(data: CreateEventTypeInput) {
    return this.db
      .insert(eventTypes)
      .values(data)
      .returning(publicEventTypeColumns)
      .then((r) => r[0]!);
  }

  updateById(id: string, data: UpdateEventTypeInput) {
    return this.db
      .update(eventTypes)
      .set(data)
      .where(eq(eventTypes.id, id))
      .returning(publicEventTypeColumns)
      .then((r) => r[0]);
  }

  setActive(id: string, isActive: boolean) {
    return this.db
      .update(eventTypes)
      .set({ isActive })
      .where(eq(eventTypes.id, id))
      .returning(publicEventTypeColumns)
      .then((r) => r[0]);
  }
}
