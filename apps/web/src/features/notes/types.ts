import type { RouterOutputs } from '@/lib/trpc/types';

/** Entidad Note inferida del output del router tRPC. No se declara a mano. */
export type Note = RouterOutputs['notes']['list'][number];
