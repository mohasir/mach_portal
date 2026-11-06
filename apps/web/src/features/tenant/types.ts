import type { RouterOutputs } from '@/lib/trpc/types';

export type Organization = RouterOutputs['tenant']['memberships'][number];
export type ActiveTenant = NonNullable<RouterOutputs['tenant']['active']>;
