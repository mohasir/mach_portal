import { asc, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { UsersListQuery } from '@repo/schemas';
import type { Database } from '../../db';
import { session, user } from '../../db/schema';
import { publicUserColumns } from './users.resource';

const sortColumns = {
  name: user.name,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
} as const;

const publicSelection = () => ({
  ...publicUserColumns,
  sessionsCount: sql<number>`(
    select count(*)::int from ${session}
    where ${session.userId} = ${user.id} and ${session.expiresAt} > now()
  )`,
});

export class UsersRepository {
  constructor(private db: Database) {}

  async findPaginated(query: UsersListQuery) {
    const { page, pageSize, search, sortBy, sortDir } = query;
    const where = search
      ? or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`))
      : undefined;
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);

    const items = await this.db
      .select(publicSelection())
      .from(user)
      .where(where)
      .orderBy(orderBy)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const total = await this.countAll(where);
    return { items, total };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db.select({ value: count() }).from(user).where(where);
    return row?.value ?? 0;
  }

  findByEmail(email: string) {
    return this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
      .then((r) => r[0]);
  }

  updateById(id: string, data: Partial<typeof user.$inferInsert>) {
    return this.db
      .update(user)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(user.id, id))
      .returning(publicSelection())
      .then((r) => r[0]);
  }

  deleteById(id: string) {
    return this.db
      .delete(user)
      .where(eq(user.id, id))
      .returning({ id: user.id })
      .then((r) => r[0]);
  }
}
