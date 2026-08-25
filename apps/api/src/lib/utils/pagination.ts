import type { ListQuery } from '@repo/schemas';
import { APP_CONFIG } from '../appConfig';

export interface ResolvedPagination {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
  paginate: boolean;
}

export function resolvePagination(query: Pick<ListQuery, 'page' | 'pageSize'>): ResolvedPagination {
  if (query.page == null && query.pageSize == null) {
    return {
      page: 1,
      pageSize: APP_CONFIG.unpaginatedListLimit,
      limit: APP_CONFIG.unpaginatedListLimit,
      offset: 0,
      paginate: false,
    };
  }
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize, paginate: true };
}
