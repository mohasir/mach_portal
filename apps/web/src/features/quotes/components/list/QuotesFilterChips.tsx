'use client';
import { useTranslation } from 'react-i18next';
import { STATE_NAMES, stateSchema, type StateValue } from '@repo/schemas';
import { AvatarUser } from '@/components/shared/AvatarUser';
import {
  FilterChips,
  FilterChipSelect,
  FilterChipToggle,
  type FilterOption,
} from '@/components/shared/FilterChips';
import { useEventTypesList } from '@/features/event-types';
import { useUsersList } from '@/features/users';
import { useSession } from '@/lib/auth/client';
import { useCanReassignQuote } from '@/lib/auth/useCan';
import type { QuotesPageFilters } from '../../types';

interface QuotesFilterChipsProps {
  filters: QuotesPageFilters;
  onChange: (patch: Partial<QuotesPageFilters>) => void;
}

const AVATAR_SIZE = 28;

export function QuotesFilterChips({ filters, onChange }: QuotesFilterChipsProps) {
  const { t } = useTranslation('quotes');
  const { data: session } = useSession();
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
      <FilterChipSelect
        label={t('filters.state')}
        options={stateSchema.options.map((state) => ({
          value: state,
          label: STATE_NAMES[state],
        }))}
        value={filters.states ?? []}
        onChange={(states) => onChange({ states: toFilter(states as StateValue[]) })}
      />
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
    </FilterChips>
  );
}

/** An empty selection means "no filter", not "match nothing". */
const toFilter = <T,>(values: T[]) => (values.length ? values : undefined);
