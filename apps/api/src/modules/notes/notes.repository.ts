import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { notes } from '../../db/schema';

export class NotesRepository {
  constructor(private db: Database) {}

  findAllByUser(userId: string) {
    return this.db.select().from(notes).where(eq(notes.userId, userId)).orderBy(desc(notes.createdAt));
  }

  create(data: typeof notes.$inferInsert) {
    return this.db
      .insert(notes)
      .values(data)
      .returning()
      .then((r) => r[0]);
  }

  update(id: string, userId: string, data: Partial<typeof notes.$inferInsert>) {
    return this.db
      .update(notes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning()
      .then((r) => r[0]);
  }

  delete(id: string, userId: string) {
    return this.db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning()
      .then((r) => r[0]);
  }
}
