'use client';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { QuotesViewOptions } from '@repo/schemas';
import { useConfig, useUpdateUserPreferences, useUserPreferences } from '@/features/settings';
import { useCan } from '@/lib/auth/useCan';

/**
 * Per-user options for what the quotes views include. Each one is only offered when it applies:
 * hiding stale quotes needs the business to allow it (app settings), and including archived
 * ones needs QUOTE/VIEW_ARCHIVED. An option that isn't offered is off.
 */
export function useQuotesViewOptions() {
  const can = useCan();
  const configQuery = useConfig();
  const preferencesQuery = useUserPreferences();
  const config = configQuery.data;
  const preferences = preferencesQuery.data;
  // Settled either way: a failed preferences fetch falls back to defaults instead of blocking.
  const ready =
    (configQuery.isSuccess || configQuery.isError) &&
    (preferencesQuery.isSuccess || preferencesQuery.isError);
  const { updateUserPreferences, isPending } = useUpdateUserPreferences();

  const canHideStale = !!config?.appSettings.hideStaleQuotes;
  const canIncludeArchived = can({ [RESOURCES.QUOTE]: [ACTIONS.VIEW_ARCHIVED] });

  const viewOptions: QuotesViewOptions = {
    hideStale: canHideStale && !!preferences?.quotesHideStale,
    includeArchived: canIncludeArchived && !!preferences?.quotesIncludeArchived,
  };

  return {
    viewOptions,
    /** False until config and preferences arrive; querying before that would use the defaults and
     * then refetch with the real options, swapping the results under the user. */
    ready,
    canHideStale,
    canIncludeArchived,
    setHideStale: (quotesHideStale: boolean) => updateUserPreferences({ quotesHideStale }),
    setIncludeArchived: (quotesIncludeArchived: boolean) =>
      updateUserPreferences({ quotesIncludeArchived }),
    isPending,
  };
}
