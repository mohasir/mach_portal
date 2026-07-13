import type { RouterOutputs } from '@/lib/trpc/types';

/** Entidad Staff inferida del output del router tRPC. No se declara a mano. */
export type Staff = RouterOutputs['staff']['list']['items'][number];
