import type { RouterOutputs } from '@/lib/trpc/types';

/** Entidad Client inferida del output del router tRPC. No se declara a mano. */
export type Client = RouterOutputs['clients']['list']['items'][number];
