import { z } from 'zod';

export const sortDirSchema = z.enum(['asc', 'desc']);
export type SortDir = z.infer<typeof sortDirSchema>;

/**
 * Base query for server-driven tables. Each module extends this with its own
 * `sortBy` enum (the sortable columns), so the whitelist lives next to the data.
 */
export const listQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
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

/** Builds the pagination meta from a total count and the query that produced it. */
export function paginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
