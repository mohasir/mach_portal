'use client';
import { DatePicker, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { paymentMethodSchema, type PaymentMethod } from '@repo/schemas';
import { useClientsList } from '@/features/clients';
import { useEventTypesList } from '@/features/event-types';

export interface PaymentsFiltersValue {
  dateFrom?: Dayjs;
  dateTo?: Dayjs;
  clientId?: string;
  eventTypeId?: string;
  method?: PaymentMethod;
}

interface PaymentsFiltersProps {
  value: PaymentsFiltersValue;
  onChange: (value: PaymentsFiltersValue) => void;
}

export function PaymentsFilters({ value, onChange }: PaymentsFiltersProps) {
  const { t } = useTranslation('payments');
  const { data: clients } = useClientsList({ nameOnly: true, sortBy: 'name', sortDir: 'asc' });
  const { data: eventTypes } = useEventTypesList({ sortBy: 'name', sortDir: 'asc' });

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <DatePicker
        className="w-full sm:w-40"
        placeholder={t('filters.dateFrom')}
        value={value.dateFrom}
        onChange={(date) => onChange({ ...value, dateFrom: date ?? undefined })}
        disabledDate={(date) => !!value.dateTo && date.isAfter(value.dateTo, 'day')}
      />
      <DatePicker
        className="w-full sm:w-40"
        placeholder={t('filters.dateTo')}
        value={value.dateTo}
        onChange={(date) => onChange({ ...value, dateTo: date ?? undefined })}
        disabledDate={(date) => !!value.dateFrom && date.isBefore(value.dateFrom, 'day')}
      />
      <Select
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder={t('filters.clientPlaceholder')}
        className="w-full sm:w-48"
        value={value.clientId}
        onChange={(clientId) => onChange({ ...value, clientId })}
        options={clients?.items.map((client) => ({ value: client.id, label: client.name }))}
      />
      <Select
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder={t('filters.eventTypePlaceholder')}
        className="w-full sm:w-48"
        value={value.eventTypeId}
        onChange={(eventTypeId) => onChange({ ...value, eventTypeId })}
        options={eventTypes?.items.map((eventType) => ({
          value: eventType.id,
          label: eventType.name,
        }))}
      />
      <Select
        allowClear
        placeholder={t('filters.methodPlaceholder')}
        className="w-full sm:w-40"
        value={value.method}
        onChange={(method) => onChange({ ...value, method })}
        options={paymentMethodSchema.options.map((method) => ({
          value: method,
          label: t(`paymentMethods.${method}`),
        }))}
      />
    </div>
  );
}
