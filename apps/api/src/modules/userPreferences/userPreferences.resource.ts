import { userPreferencesSchema } from '@repo/schemas';
import { userPreferences } from '../../db/schema';

export const publicUserPreferencesColumns = {
  preferences: userPreferences.preferences,
} as const;

export type PublicUserPreferences = Pick<
  typeof userPreferences.$inferSelect,
  keyof typeof publicUserPreferencesColumns
>;

// A user without a row yet gets every default, same as one whose stored JSON predates a key.
export const userPreferencesResource = (row: PublicUserPreferences | undefined) =>
  userPreferencesSchema.parse(row?.preferences ?? {});

export type UserPreferencesResource = ReturnType<typeof userPreferencesResource>;
