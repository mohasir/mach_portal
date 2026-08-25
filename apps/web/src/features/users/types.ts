import type { RouterOutputs } from '@/lib/trpc/types';

/** Entidad User inferida del output del router tRPC. No se declara a mano. */
export type User = RouterOutputs['users']['list']['items'][number];
