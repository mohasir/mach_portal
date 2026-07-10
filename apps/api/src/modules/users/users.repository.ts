import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { user } from '../../db/schema';

const publicColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  banned: user.banned,
  createdAt: user.createdAt,
} as const;

export class UsersRepository {
  constructor(private db: Database) {}

  findAll() {
    return this.db.select(publicColumns).from(user).orderBy(desc(user.createdAt));
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
      .returning(publicColumns)
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
