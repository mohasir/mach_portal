import { and, eq, sql } from 'drizzle-orm';
import type { UpdateUserPreferencesInput } from '@repo/schemas';
import type { Database } from '../../db';
import { userPreferences } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import {
  publicUserPreferencesColumns,
  type PublicUserPreferences,
} from './userPreferences.resource';

export class UserPreferencesRepository {
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}

  findByUserId(userId: string) {
    return this.db
      .select(publicUserPreferencesColumns)
      .from(userPreferences)
      .where(and(eq(userPreferences.userId, userId), tenantEq(userPreferences, this.tenantId)))
      .limit(1)
      .then((r) => r[0] as PublicUserPreferences | undefined);
  }

  // Merges in SQL so concurrent partial saves (e.g. locale from one device, time format from
  // another) can't overwrite each other, and only the keys actually sent are stored.
  merge(userId: string, patch: UpdateUserPreferencesInput) {
    return this.db
      .insert(userPreferences)
      .values({ userId, preferences: patch, tenantId: this.tenantId })
      .onConflictDoUpdate({
        target: [userPreferences.tenantId, userPreferences.userId],
        set: {
          preferences: sql`${userPreferences.preferences} || excluded.preferences`,
          updatedAt: new Date(),
        },
      })
      .returning(publicUserPreferencesColumns)
      .then((r) => r[0]!);
  }
}
