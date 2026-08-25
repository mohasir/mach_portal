import type { RouterOutputs } from '@/lib/trpc/types';

/** Config inferida del output del router tRPC (get(), no paginado). No se declara a mano. */
export type Config = RouterOutputs['config']['get'];
