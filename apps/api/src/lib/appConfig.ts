/**
 * Static, read-only application config.
 */
export const APP_CONFIG = {
  /** Rows returned by a list endpoint when the caller sends neither `page` nor `pageSize`. */
  unpaginatedListLimit: 200,
} as const;
