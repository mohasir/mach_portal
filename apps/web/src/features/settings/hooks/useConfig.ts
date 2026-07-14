import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

export function useConfig(enabled = true) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.config.get.queryOptions(), staleTime: Infinity, enabled });
}
