'use client';
import { useQuery } from '@tanstack/react-query';
import { loadLocalities, type CountryCode } from '@repo/geo';

// Localities ship as one lazily loaded chunk per region, so they are fetched only when
// a region is picked and never change within a session.
export function useLocalities(country: CountryCode | null, region: string | null) {
  const query = useQuery({
    queryKey: ['geo', 'localities', country, region],
    queryFn: () => loadLocalities(country as CountryCode, region as string),
    enabled: !!country && !!region,
    staleTime: Infinity,
  });
  return { localities: query.data ?? [], isLoading: query.isLoading };
}
