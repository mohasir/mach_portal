import { z } from 'zod';

export const sortDirSchema = z.enum(['asc', 'desc']);
export type SortDir = z.infer<typeof sortDirSchema>;

/**
 * Base query for server-driven tables. Each module extends this with its own
 * `sortBy` enum (the sortable columns), so the whitelist lives next to the data.
 * `page`/`pageSize` are optional: omitting both returns every row (capped — see
 * `apps/api/src/lib/appConfig.ts`) instead of a paginated page.
 */
export const listQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(200).optional(),
  sortDir: sortDirSchema.default('desc'),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}

/** Returned instead of `Paginated<T>` when the caller sent neither `page` nor `pageSize`. */
export interface Unpaginated<T> {
  items: T[];
}

/** Builds the pagination meta from a total count and the query that produced it. */
export function paginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Safely reads `.pagination` off a list response that may be `Paginated<T>` or `Unpaginated<T>`
 * (a plain `data?.pagination.total` doesn't type-check since the property is absent on one arm
 * of the union). Callers that always send `page`/`pageSize` (e.g. `useDataTable`) will always
 * get a value back here; it's `undefined` only for a response that opted out of pagination.
 */
export function paginationOf<T>(
  data: Paginated<T> | Unpaginated<T> | undefined,
): PaginationMeta | undefined {
  return data && 'pagination' in data ? data.pagination : undefined;
}
