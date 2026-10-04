import { eq } from 'drizzle-orm';
import type { UserPreferences } from '@repo/schemas';
import type { Database } from '../../db';
import { userPreferences } from '../../db/schema';
import {
  publicUserPreferencesColumns,
  type PublicUserPreferences,
} from './userPreferences.resource';

export class UserPreferencesRepository {
  constructor(private db: Database) {}

  findByUserId(userId: string) {
    return this.db
      .select(publicUserPreferencesColumns)
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1)
      .then((r) => r[0] as PublicUserPreferences | undefined);
  }

  upsert(userId: string, preferences: UserPreferences) {
    return this.db
      .insert(userPreferences)
      .values({ userId, preferences })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { preferences, updatedAt: new Date() },
      })
      .returning(publicUserPreferencesColumns)
      .then((r) => r[0]!);
  }
}
