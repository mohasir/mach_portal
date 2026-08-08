import type { RouterOutputs } from '@/lib/trpc/types';

/** Entidad Notification inferida del output del router tRPC. No se declara a mano. */
export type Notification = RouterOutputs['notifications']['list']['items'][number];
