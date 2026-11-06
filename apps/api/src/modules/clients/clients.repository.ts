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
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { resolvePagination } from '../../lib/utils/pagination';
import { publicClientColumns } from './clients.resource';
import { containsPattern } from '../../lib/utils/search';

const sortColumns = {
  name: clients.name,
  city: clients.city,
  state: clients.state,
  createdAt: clients.createdAt,
} as const;

export class ClientsRepository {
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}

  // Derived status (D3): 'active' if the client has a confirmed (Aprobada) quote, else 'lead'.
  // The `quotes` subquery is tenant-filtered too: a subquery is a separate read of a tenant table.
  // Built as a proper correlated subquery (not a raw string template) so `clients.id` is
  // qualified correctly — `quotes` also has an `id` column, which a raw-interpolated
  // `where quotes.client_id = clients.id` silently resolves against the wrong table.
  private selection() {
    const activeQuotes = this.db
      .select({ one: sql`1` })
      .from(quotes)
      .where(
        and(
          eq(quotes.clientId, clients.id),
          eq(quotes.stageId, QUOTE_STAGE.CONFIRMED),
          tenantEq(quotes, this.tenantId),
        ),
      );
    const status = sql<ClientStatus>`(case when ${exists(activeQuotes)} then 'active' else 'lead' end)`;
    return { ...publicClientColumns, status };
  }

  async findPaginated(query: ClientsListQuery) {
    const { search, sortBy, sortDir, nameOnly } = query;
    const searchFilter = search
      ? nameOnly
        ? ilike(clients.name, containsPattern(search))
        : or(
            ilike(clients.name, containsPattern(search)),
            ilike(clients.email, containsPattern(search)),
            ilike(clients.phone, containsPattern(search)),
          )
      : undefined;
    const where = and(tenantEq(clients, this.tenantId), searchFilter);
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
      .where(and(eq(clients.id, id), tenantEq(clients, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  create(data: CreateClientInput) {
    return this.db
      .insert(clients)
      .values({ ...data, tenantId: this.tenantId })
      .returning(this.selection())
      .then((r) => r[0]!);
  }

  updateById(id: string, data: UpdateClientInput) {
    return this.db
      .update(clients)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(clients.id, id), tenantEq(clients, this.tenantId)))
      .returning(this.selection())
      .then((r) => r[0]);
  }

  deleteById(id: string) {
    return this.db
      .delete(clients)
      .where(and(eq(clients.id, id), tenantEq(clients, this.tenantId)))
      .returning({ id: clients.id })
      .then((r) => r[0]);
  }
}
