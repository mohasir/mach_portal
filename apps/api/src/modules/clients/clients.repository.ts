import { asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type {
  ClientsListQuery,
  ClientStatus,
  CreateClientInput,
  UpdateClientInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import { clients } from '../../db/schema';
import { publicClientColumns } from './clients.resource';

const sortColumns = {
  name: clients.name,
  city: clients.city,
  state: clients.state,
  createdAt: clients.createdAt,
} as const;

// Derived status. In phase 1 there are no quotes yet, so it is always 'lead';
// phase 4 swaps this literal for an EXISTS on confirmed/completed quotes (D3).
const statusExpr = sql<ClientStatus>`'lead'`;

const publicSelection = () => ({ ...publicClientColumns, status: statusExpr });

export class ClientsRepository {
  constructor(private db: Database) {}

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
      .select(publicSelection())
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
      .returning(publicSelection())
      .then((r) => r[0]!);
  }

  updateById(id: string, data: UpdateClientInput) {
    return this.db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning(publicSelection())
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
