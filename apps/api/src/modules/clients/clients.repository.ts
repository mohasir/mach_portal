import { and, asc, count, desc, eq, exists, ilike, or, sql, type SQL } from 'drizzle-orm';
import {
  QUOTE_STAGE,
  type ClientsListQuery,
  type ClientStatus,
  type CreateClientInput,
  type UpdateClientInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import { clients, quotes } from '../../db/schema';
import { resolvePagination } from '../../lib/utils/pagination';
import { publicClientColumns } from './clients.resource';

const sortColumns = {
  name: clients.name,
  city: clients.city,
  state: clients.state,
  createdAt: clients.createdAt,
} as const;

export class ClientsRepository {
  constructor(private db: Database) {}

  // Derived status (D3): 'active' if the client has a confirmed (Aprobada) quote, else 'lead'.
  // Built as a proper correlated subquery (not a raw string template) so `clients.id` is
  // qualified correctly — `quotes` also has an `id` column, which a raw-interpolated
  // `where quotes.client_id = clients.id` silently resolves against the wrong table.
  private selection() {
    const activeQuotes = this.db
      .select({ one: sql`1` })
      .from(quotes)
      .where(and(eq(quotes.clientId, clients.id), eq(quotes.stageId, QUOTE_STAGE.CONFIRMED)));
    const status = sql<ClientStatus>`(case when ${exists(activeQuotes)} then 'active' else 'lead' end)`;
    return { ...publicClientColumns, status };
  }

  async findPaginated(query: ClientsListQuery) {
    const { search, sortBy, sortDir, nameOnly } = query;
    const where = search
      ? nameOnly
        ? ilike(clients.name, `%${search}%`)
        : or(
            ilike(clients.name, `%${search}%`),
            ilike(clients.email, `%${search}%`),
            ilike(clients.phone, `%${search}%`),
          )
      : undefined;
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.db
      .select(this.selection())
      .from(clients)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const total = paginate ? await this.countAll(where) : items.length;
    return { items, total, paginate, page, pageSize };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db.select({ value: count() }).from(clients).where(where);
    return row?.value ?? 0;
  }

  findById(id: string) {
    return this.db
      .select(this.selection())
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1)
      .then((r) => r[0]);
  }

  create(data: CreateClientInput) {
    return this.db
      .insert(clients)
      .values(data)
      .returning(this.selection())
      .then((r) => r[0]!);
  }

  updateById(id: string, data: UpdateClientInput) {
    return this.db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning(this.selection())
      .then((r) => r[0]);
  }

  deleteById(id: string) {
    return this.db
      .delete(clients)
      .where(eq(clients.id, id))
      .returning({ id: clients.id })
      .then((r) => r[0]);
  }
}
