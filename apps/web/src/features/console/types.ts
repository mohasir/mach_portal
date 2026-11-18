import type { RouterOutputs } from '@/lib/trpc/types';

export type ConsoleGlobalSummary = RouterOutputs['console']['summary']['global'];
export type ExpiringFeature = ConsoleGlobalSummary['expiringFeatures'][number];

export type ConsoleOrganization = RouterOutputs['console']['organizations']['get'];
export type ConsoleOrganizationRow = Extract<
  RouterOutputs['console']['organizations']['list'],
  { pagination: unknown }
>['items'][number];
export type ConsoleFeature = RouterOutputs['console']['features']['list'][number];
export type ConsoleOrganizationSummary = RouterOutputs['console']['summary']['organization'];
export type ConsoleHistoryItem = RouterOutputs['console']['history']['list'][number];
