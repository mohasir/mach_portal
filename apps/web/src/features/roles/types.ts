import type { RouterOutputs } from '@/lib/trpc/types';

export type Role = RouterOutputs['roles']['list'][number];
export type RoleDetail = RouterOutputs['roles']['get'];
