import type { RouterOutputs } from '@/lib/trpc/types';

export type RescheduleReason = RouterOutputs['rescheduleReasons']['list']['items'][number];
