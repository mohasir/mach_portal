'use client';
import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { localeSchema, type UpdateUserPreferencesInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';
import { useLocaleStore } from '@/lib/stores/locale.store';

export function useUserPreferences(enabled = true) {
  const trpc = useTRPC();
  return useQuery({ ...trpc.userPreferences.get.queryOptions(), staleTime: Infinity, enabled });
}

export function useUpdateUserPreferences() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.userPreferences.update.mutationOptions({
      onSuccess: (data) => qc.setQueryData(trpc.userPreferences.get.queryKey(), data),
      onError,
    }),
  );

  return {
    updateUserPreferences: (data: UpdateUserPreferencesInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

// Once per signed-in user, lines up the browser's locale store with the saved `locale`
// preference: the saved value wins when there is one; otherwise the browser's current choice is
// saved so other devices pick it up. Later changes go through UserPreferencesCard, which saves
// and applies them itself.
export function useSyncUserPreferences(userId: string | undefined) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data: preferences } = useUserPreferences(!!userId);
  const { updateUserPreferences } = useUpdateUserPreferences();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const reconciledFor = useRef<string | undefined>(undefined);
  const seenUserId = useRef(userId);

  // The query key isn't per user and the cache survives sign-out, so a different account
  // signing in on the same tab would otherwise read the previous account's preferences.
  useEffect(() => {
    if (seenUserId.current === userId) return;
    seenUserId.current = userId;
    reconciledFor.current = undefined;
    void qc.resetQueries(trpc.userPreferences.get.queryFilter());
  }, [userId, qc, trpc]);

  useEffect(() => {
    if (!userId || !preferences || reconciledFor.current === userId) return;
    reconciledFor.current = userId;

    if (preferences.locale) {
      if (preferences.locale !== locale) setLocale(preferences.locale);
      return;
    }
    const parsed = localeSchema.safeParse(locale);
    if (parsed.success) void updateUserPreferences({ locale: parsed.data });
  }, [userId, preferences, locale, setLocale]);
}
