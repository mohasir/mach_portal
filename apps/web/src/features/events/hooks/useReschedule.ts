import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CheckRescheduleQuery, RescheduleEventInput } from '@repo/schemas';
import { useApiError } from '@/lib/error/useApiError';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
import { useTRPC } from '@/lib/trpc/client';

const CHECK_DEBOUNCE_MS = 400;

export function useCheckReschedule(eventId: string, eventDate?: string, eventTime?: string) {
  const trpc = useTRPC();
  const date = useDebouncedValue(eventDate, CHECK_DEBOUNCE_MS);
  const time = useDebouncedValue(eventTime, CHECK_DEBOUNCE_MS);
  const query = useQuery({
    ...trpc.events.checkReschedule.queryOptions({ eventId, eventDate: date!, eventTime: time }),
    enabled: !!date,
  });
  // While the debounce catches up, `data` still belongs to the previous date/time.
  const isStale = date !== eventDate || time !== eventTime;
  return { ...query, isChecking: query.isFetching || isStale };
}

// Saving must decide the staff-conflict confirmation on the values being saved, never on
// a preview that may still be in flight.
export function useFetchRescheduleCheck() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  return (input: CheckRescheduleQuery) =>
    qc.fetchQuery(trpc.events.checkReschedule.queryOptions(input));
}

export function useRescheduleEvent() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();
  const { message } = App.useApp();
  const { t } = useTranslation('events');

  const mutation = useMutation(
    trpc.events.reschedule.mutationOptions({
      onSuccess: () => {
        message.success(t('reschedule.success'));
        return Promise.all([
          qc.invalidateQueries(trpc.events.pathFilter()),
          qc.invalidateQueries(trpc.quotes.pathFilter()),
          qc.invalidateQueries(trpc.staff.getAvailability.queryFilter()),
        ]);
      },
      onError,
    }),
  );

  return {
    rescheduleEvent: (input: RescheduleEventInput) => mutation.mutateAsync(input),
    isPending: mutation.isPending,
  };
}
