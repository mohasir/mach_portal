import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

export function useConsoleGlobalSummary() {
  const trpc = useTRPC();
  return useQuery(trpc.console.summary.global.queryOptions());
}
