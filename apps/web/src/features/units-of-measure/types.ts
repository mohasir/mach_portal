import type { RouterOutputs } from '@/lib/trpc/types';

/** Unit of measure inferred from the tRPC router output. */
export type UnitOfMeasure = RouterOutputs['unitsOfMeasure']['list']['items'][number];
