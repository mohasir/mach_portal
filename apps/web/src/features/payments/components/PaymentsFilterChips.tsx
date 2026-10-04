'use client';
import { useTranslation } from 'react-i18next';
import { paymentMethodSchema, type PaymentMethod } from '@repo/schemas';
import {
  FilterChipDateRange,
  FilterChips,
  FilterChipSelect,
} from '@/components/shared/FilterChips';
import { useClientsList } from '@/features/clients';
import { useEventTypesList } from '@/features/event-types';
import type { PaymentsFilters } from '../types';

interface PaymentsFilterChipsProps {
  filters: PaymentsFilters;
  onChange: (patch: Partial<PaymentsFilters>) => void;
}

export function PaymentsFilterChips({ filters, onChange }: PaymentsFilterChipsProps) {
  const { t } = useTranslation('payments');
  const { data: clients } = useClientsList({ nameOnly: true, sortBy: 'name', sortDir: 'asc' });
  const { data: eventTypes } = useEventTypesList({ sortBy: 'name', sortDir: 'asc' });

  return (
    <FilterChips>
      <FilterChipDateRange
        label={t('filters.date')}
        disableFuture
        value={{ from: filters.dateFrom, to: filters.dateTo }}
        onChange={({ from, to }) => onChange({ dateFrom: from, dateTo: to })}
      />
      <FilterChipSelect
        label={t('filters.client')}
        searchable
        options={(clients?.items ?? []).map((client) => ({ value: client.id, label: client.name }))}
        value={filters.clientIds ?? []}
        onChange={(ids) => onChange({ clientIds: toFilter(ids) })}
      />
      <FilterChipSelect
        label={t('filters.eventType')}
        options={(eventTypes?.items ?? []).map((type) => ({ value: type.id, label: type.name }))}
        value={filters.eventTypeIds ?? []}
        onChange={(ids) => onChange({ eventTypeIds: toFilter(ids) })}
      />
      <FilterChipSelect
        label={t('filters.method')}
        options={paymentMethodSchema.options.map((method) => ({
          value: method,
          label: t(`paymentMethods.${method}`),
        }))}
        value={filters.methods ?? []}
        onChange={(methods) => onChange({ methods: toFilter(methods as PaymentMethod[]) })}
      />
    </FilterChips>
  );
}

/** An empty selection means "no filter", not "match nothing". */
const toFilter = <T,>(values: T[]) => (values.length ? values : undefined);
