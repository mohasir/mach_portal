'use client';
import { useTranslation } from 'react-i18next';
import type { QuotesViewOptions } from '@repo/schemas';
import { AvatarUser } from '@/components/shared/AvatarUser';
import {
  FilterChips,
  FilterChipSelect,
  FilterChipToggle,
  type FilterOption,
} from '@/components/shared/FilterChips';
import { useEventTypesList } from '@/features/event-types';
import { useLocationSettings } from '@/features/settings';
import { regionOptions, levelTitle } from '@/components/shared/LocationFields/helpers';
import { useUsersList } from '@/features/users';
import { useSession } from '@/lib/auth/client';
import { useLocaleStore } from '@/lib/stores/locale.store';
import { useCanReassignQuote } from '@/lib/auth/useCan';
import type { QuotesViewTab } from '../../quotesView.store';
import type { QuotesPageFilters } from '../../types';

interface QuotesFilterChipsProps {
  filters: QuotesPageFilters;
  /** Chips for quotes the view leaves out are hidden: they would match nothing. */
  viewOptions: QuotesViewOptions;
  view: QuotesViewTab;
  onChange: (patch: Partial<QuotesPageFilters>) => void;
}

const AVATAR_SIZE = 28;

export function QuotesFilterChips({
  filters,
  viewOptions,
  view,
  onChange,
}: QuotesFilterChipsProps) {
  const { t } = useTranslation('quotes');
  const { data: session } = useSession();
  const lang = useLocaleStore((s) => s.locale);
  const { data: location } = useLocationSettings();
  // Users who only see their own quotes have nobody else to filter by.
  const canFilterByAssignee = useCanReassignQuote();
  const { data: users } = useUsersList({ sortBy: 'name', sortDir: 'asc' }, canFilterByAssignee);
  const { data: eventTypes } = useEventTypesList({
    page: 1,
    pageSize: 100,
    sortBy: 'sortOrder',
    sortDir: 'asc',
  });

  const me = session?.user;
  const assigneeOptions: FilterOption[] = [
    ...(me
      ? [
          {
            value: me.id,
            label: t('filters.me'),
            icon: <AvatarUser name={me.name} size={AVATAR_SIZE} showDetails={false} />,
          },
        ]
      : []),
    ...(users?.items ?? [])
      .filter((user) => user.id !== me?.id && !user.banned)
      .map((user) => ({
        value: user.id,
        label: user.name,
        icon: <AvatarUser name={user.name} size={AVATAR_SIZE} showDetails={false} />,
      })),
  ];

  return (
    <FilterChips>
      {location?.country && location.depth !== 0 && (
        <FilterChipSelect
          label={levelTitle(location.country, 1, lang)}
          options={regionOptions(location.country)}
          value={filters.regions ?? []}
          onChange={(regions) => onChange({ regions: toFilter(regions) })}
        />
      )}
      {canFilterByAssignee && (
        <FilterChipSelect
          label={t('filters.assignee')}
          options={assigneeOptions}
          value={filters.assignedToIds ?? []}
          onChange={(ids) => onChange({ assignedToIds: toFilter(ids) })}
        />
      )}
      <FilterChipSelect
        label={t('filters.eventType')}
        options={(eventTypes?.items ?? []).map((type) => ({ value: type.id, label: type.name }))}
        value={filters.eventTypeIds ?? []}
        onChange={(ids) => onChange({ eventTypeIds: toFilter(ids) })}
      />
      <FilterChipToggle
        label={t('filters.drafts')}
        checked={!!filters.isDraft}
        onChange={(checked) => onChange({ isDraft: checked || undefined })}
      />
      {!viewOptions.hideStale && (
        <FilterChipToggle
          label={t('filters.stale')}
          checked={!!filters.stale}
          onChange={(checked) => onChange({ stale: checked || undefined })}
        />
      )}
      {viewOptions.includeArchived && view === 'table' && (
        <FilterChipToggle
          label={t('filters.archived')}
          checked={!!filters.archived}
          onChange={(checked) => onChange({ archived: checked || undefined })}
        />
      )}
    </FilterChips>
  );
}

/** An empty selection means "no filter", not "match nothing". */
const toFilter = <T,>(values: T[]) => (values.length ? values : undefined);
