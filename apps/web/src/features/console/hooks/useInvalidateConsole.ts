import { useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/lib/trpc/client';

export function useInvalidateConsole() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries(trpc.console.organizations.pathFilter()),
      qc.invalidateQueries(trpc.console.features.pathFilter()),
      qc.invalidateQueries(trpc.console.summary.pathFilter()),
      qc.invalidateQueries(trpc.console.history.pathFilter()),
    ]);
}
