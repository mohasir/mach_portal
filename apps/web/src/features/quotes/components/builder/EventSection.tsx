'use client';
import { DatePicker, Form, Input, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { STATE_NAMES, stateSchema, type StateValue } from '@repo/schemas';
import type { EventType } from '@/features/event-types';
import { AutoCloseTimePicker } from '@/components/shared/Inputs/AutoCloseTimePicker';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useConfig } from '@/features/settings';
import { blurActiveElementOnTouch } from '@/lib/utils/dom';
import CITIES_BY_STATE from '../../citiesByState.json';
import { useQuoteBuilder, type QuoteBuilderState } from '../../hooks/useQuoteBuilder';
import { useQuoteAvailability } from '../../hooks/useQuotes';

interface EventSectionProps {
  eventTypes: EventType[];
  readOnly?: boolean;
  quoteId?: string;
}

interface EventFormValues {
  eventTypeId?: string;
  eventDate?: Dayjs;
  eventTime?: Dayjs;
  state?: StateValue;
  city?: string;
  address?: string;
  longDistanceAmount?: number;
}

const CITIES_BY_STATE_MAP = CITIES_BY_STATE as Record<StateValue, string[]>;

export function EventSection({ eventTypes, readOnly, quoteId }: EventSectionProps) {
  const { t } = useTranslation('quotes');
  const { state, setFields } = useQuoteBuilder();
  const { data: config } = useConfig();
  const [form] = Form.useForm<EventFormValues>();
  const eventDate = Form.useWatch('eventDate', form);
  const eventTime = Form.useWatch('eventTime', form);
  const selectedState = Form.useWatch('state', form);

  const eventDateStr = eventDate?.format('YYYY-MM-DD');
  const eventTimeStr = eventTime?.format('HH:mm');
  const { data: availability, isFetching: isCheckingAvailability } = useQuoteAvailability(
    eventDateStr,
    eventTimeStr,
    quoteId,
  );
  const conflicts = availability?.conflicts ?? [];
  const hasConflicts = !!availability && conflicts.length > 0;
  const availabilityStatus =
    !eventDateStr || !eventTimeStr
      ? undefined
      : isCheckingAvailability
        ? ('validating' as const)
        : hasConflicts
          ? undefined
          : ('success' as const);

  const cityOptions = (selectedState ? (CITIES_BY_STATE_MAP[selectedState] ?? []) : []).map(
    (city) => ({ value: city, label: city }),
  );

  const disabledDate = (current: Dayjs) => current.isBefore(dayjs(), 'day');

  const disabledTime = () => {
    if (!eventDate || !eventDate.isSame(dayjs(), 'day')) return {};
    const now = dayjs();
    return {
      disabledHours: () => Array.from({ length: now.hour() }, (_, h) => h),
      disabledMinutes: (selectedHour: number) =>
        selectedHour === now.hour() ? Array.from({ length: now.minute() }, (_, m) => m) : [],
    };
  };

  const initialValues: EventFormValues = {
    eventTypeId: state.eventTypeId ?? undefined,
    eventDate: state.eventDate ? dayjs(state.eventDate) : undefined,
    eventTime: state.eventTime ? dayjs(state.eventTime, 'HH:mm') : undefined,
    state: state.state ?? undefined,
    city: state.city,
    address: state.address,
    longDistanceAmount: state.longDistanceAmount,
  };

  const handleValuesChange = (changed: Partial<EventFormValues>) => {
    const patch: Partial<QuoteBuilderState> = {};
    if ('eventTypeId' in changed) patch.eventTypeId = changed.eventTypeId ?? null;
    if ('eventDate' in changed) {
      patch.eventDate = changed.eventDate ? changed.eventDate.format('YYYY-MM-DD') : null;
    }
    if ('eventTime' in changed) {
      patch.eventTime = changed.eventTime ? changed.eventTime.format('HH:mm') : null;
    }
    if ('state' in changed) {
      patch.state = changed.state ?? null;
      const validCities = changed.state ? (CITIES_BY_STATE_MAP[changed.state] ?? []) : [];
      if (!validCities.includes(form.getFieldValue('city'))) {
        form.setFieldValue('city', undefined);
        patch.city = '';
      }

      // Suggests the fee from the new state's tax rate — a starting point the staff overrides freely.
      const nextTaxRate = changed.state
        ? (config?.stateSettings.find((s) => s.state === changed.state)?.taxRate ?? 0)
        : 0;
      const subtotal = state.lines.reduce((sum, line) => sum + line.subtotal, 0);
      const suggestedLongDistance = Math.round(subtotal * nextTaxRate);
      patch.longDistanceAmount = suggestedLongDistance;
      form.setFieldValue('longDistanceAmount', suggestedLongDistance);
    }
    if ('city' in changed) patch.city = changed.city ?? '';
    if ('address' in changed) patch.address = changed.address ?? '';
    if ('longDistanceAmount' in changed) {
      patch.longDistanceAmount = changed.longDistanceAmount ?? 0;
    }
    setFields(patch);
  };

  const eventTypeField = (
    <Form.Item name="eventTypeId" label={<FieldLabel title={t('builder.event.type')} />}>
      <Select
        allowClear
        placeholder={t('builder.event.typePlaceholder')}
        options={eventTypes.map((e) => ({ value: e.id, label: e.name }))}
      />
    </Form.Item>
  );

  const eventDateField = (
    <Form.Item
      name="eventDate"
      label={<FieldLabel title={t('builder.event.date')} />}
      hasFeedback={!!availabilityStatus}
      validateStatus={availabilityStatus}
    >
      <DatePicker className="w-full" disabledDate={disabledDate} />
    </Form.Item>
  );

  const eventTimeField = (
    <Form.Item
      name="eventTime"
      label={<FieldLabel title={t('builder.event.time')} />}
      hasFeedback={!!availabilityStatus}
      validateStatus={availabilityStatus}
    >
      <AutoCloseTimePicker
        className="w-full"
        format="HH:mm"
        minuteStep={15}
        classNames={{ popup: { content: 'min-w-[150px]' } }}
        disabledTime={disabledTime}
      />
    </Form.Item>
  );

  const stateField = (
    <Form.Item
      name="state"
      label={<FieldLabel title={t('builder.event.state')} required />}
      required
    >
      <Select
        allowClear
        placeholder={t('builder.event.statePlaceholder')}
        options={stateSchema.options.map((s) => ({ value: s, label: STATE_NAMES[s] }))}
      />
    </Form.Item>
  );

  const cityField = (
    <Form.Item name="city" label={<FieldLabel title={t('builder.event.city')} required />} required>
      <Select
        showSearch
        allowClear
        disabled={!selectedState}
        placeholder={t('builder.event.cityPlaceholder')}
        options={cityOptions}
        onSelect={blurActiveElementOnTouch}
      />
    </Form.Item>
  );

  const addressField = (
    <Form.Item
      name="address"
      label={<FieldLabel title={t('builder.event.address')} required />}
      required
    >
      <Input.TextArea
        autoSize={{ minRows: 1, maxRows: 3 }}
        placeholder={t('builder.event.addressPlaceholder')}
      />
    </Form.Item>
  );

  return (
    <Form<EventFormValues>
      form={form}
      layout="vertical"
      disabled={readOnly}
      initialValues={initialValues}
      onValuesChange={handleValuesChange}
      requiredMark={false}
      className="flex flex-col gap-4"
    >
      <WrapperCard title={t('builder.event.eventDetailsGroupTitle')}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {eventTypeField}
          {eventDateField}
          {eventTimeField}
        </div>
        {hasConflicts && (
          <WrapperAlert
            type="warning"
            closeable={false}
            description={
              <div className="flex flex-col gap-2">
                <span>{t('builder.event.availabilityConflictDescription')}</span>
                <ul className="list-disc pl-4">
                  {conflicts.map((conflict) => (
                    <li key={conflict.id}>
                      {conflict.clientName} — {conflict.eventTypeName ?? '—'}
                    </li>
                  ))}
                </ul>
              </div>
            }
          />
        )}
      </WrapperCard>

      <WrapperCard title={t('builder.event.addressGroupTitle')}>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {stateField}
          {cityField}
          <div className="sm:col-span-2">{addressField}</div>
        </div>
      </WrapperCard>
    </Form>
  );
}
