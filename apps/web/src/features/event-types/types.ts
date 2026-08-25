import type { RouterOutputs } from '@/lib/trpc/types';

/** Entidad EventType inferida del output del router tRPC. No se declara a mano. */
export type EventType = RouterOutputs['eventTypes']['list']['items'][number];
