import type { RouterOutputs } from '@/lib/trpc/types';

/** Extra charge type inferred from the tRPC router output. */
export type ChargeType = RouterOutputs['chargeTypes']['list']['items'][number];
