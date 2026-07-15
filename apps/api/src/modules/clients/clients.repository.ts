import { and, asc, count, desc, eq, exists, ilike, inArray, or, sql, type SQL } from 'drizzle-orm';
import type {
  ClientsListQuery,
  ClientStatus,
  CreateClientInput,
  UpdateClientInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import { clients, quotes } from '../../db/schema';
import { publicClientColumns } from './clients.resource';

const sortColumns = {
  name: clients.name,
  city: clients.city,
  state: clients.state,
  createdAt: clients.createdAt,
} as const;

export class ClientsRepository {
  constructor(private db: Database) {}

  // Derived status (D3): 'active' if the client has a confirmed/completed quote, else 'lead'.
  // Built as a proper correlated subquery (not a raw string template) so `clients.id` is
  // qualified correctly — `quotes` also has an `id` column, which a raw-interpolated
  // `where quotes.client_id = clients.id` silently resolves against the wrong table.
  private selection() {
    const activeQuotes = this.db
      .select({ one: sql`1` })
      .from(quotes)
      .where(and(eq(quotes.clientId, clients.id), inArray(quotes.stage, ['confirmed', 'completed'])));
    const status = sql<ClientStatus>`(case when ${exists(activeQuotes)} then 'active' else 'lead' end)`;
    return { ...publicClientColumns, status };
  }

  async findPaginated(query: ClientsListQuery) {
    const { page, pageSize, search, sortBy, sortDir } = query;
    const where = search
      ? or(
          ilike(clients.name, `%${search}%`),
          ilike(clients.email, `%${search}%`),
          ilike(clients.phone, `%${search}%`),
        )
      : undefined;
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);

    const items = await this.db
      .select(this.selection())
      .from(clients)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const total = await this.countAll(where);
    return { items, total };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db.select({ value: count() }).from(clients).where(where);
    return row?.value ?? 0;
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
