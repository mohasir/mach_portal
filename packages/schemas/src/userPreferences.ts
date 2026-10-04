import { z } from 'zod';

export const LOCALES = ['es', 'en'] as const;
export const localeSchema = z.enum(LOCALES);
export type AppLocale = z.infer<typeof localeSchema>;

export const TIME_FORMATS = ['12h', '24h'] as const;
export const timeFormatSchema = z.enum(TIME_FORMATS);
export type TimeFormat = z.infer<typeof timeFormatSchema>;

// Read shape: stored as jsonb, so each key falls back on its own when it's missing (a preference
// added after the row was written) or no longer valid — one bad key never discards the rest.
// `locale` has no default: "not chosen yet" lets the web keep the language already picked on
// that browser instead of overriding it.
export const userPreferencesSchema = z.object({
  locale: localeSchema.optional().catch(undefined),
  timeFormat: timeFormatSchema.default('12h').catch('12h'),
  /** Quotes view: leave stale quotes out (only offered when app settings allow it). */
  quotesHideStale: z.boolean().default(false).catch(false),
  /** Quotes view: also list archived quotes (only offered with QUOTE/VIEW_ARCHIVED). */
  quotesIncludeArchived: z.boolean().default(false).catch(false),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

// Partial on purpose: each caller sends only the keys it changes and the service merges them,
// so saving one preference never resubmits (and can't clobber) the others.
export const updateUserPreferencesSchema = z
  .object({
    locale: localeSchema,
    timeFormat: timeFormatSchema,
    quotesHideStale: z.boolean(),
    quotesIncludeArchived: z.boolean(),
  })
  .partial();
export type UpdateUserPreferencesInput = z.infer<typeof updateUserPreferencesSchema>;
