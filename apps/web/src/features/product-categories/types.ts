import type { RouterOutputs } from '@/lib/trpc/types';

/** Product category inferred from the tRPC router output. */
export type ProductCategory = RouterOutputs['productCategories']['list']['items'][number];
