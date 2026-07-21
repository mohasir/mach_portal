import { useQuery } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

export function useQuotePdfTemplate() {
  const trpc = useTRPC();
  return useQuery({ ...trpc.templates.getQuotePdf.queryOptions(), staleTime: Infinity });
}
