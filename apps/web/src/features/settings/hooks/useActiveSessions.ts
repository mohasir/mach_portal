'use client';
import { useQuery } from '@tanstack/react-query';
import { listSessions } from '@/lib/auth/client';

export function useActiveSessions() {
  const query = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async () => {
      const { data, error } = await listSessions();
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  return { sessions: query.data ?? [], isLoading: query.isLoading, refetch: query.refetch };
}
