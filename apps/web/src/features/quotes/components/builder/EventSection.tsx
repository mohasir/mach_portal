'use client';
import { Card, DatePicker, Form, Input, InputNumber, Select, TimePicker, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { STATE_NAMES, stateSchema, type StateValue } from '@repo/schemas';
import type { EventType } from '@/features/event-types';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { useConfig } from '@/features/settings';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';
import CITIES_BY_STATE from '../../citiesByState.json';
import { useQuoteBuilder, type QuoteBuilderState } from '../../hooks/useQuoteBuilder';

interface EventSectionProps {
  eventTypes: EventType[];
  readOnly?: boolean;
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

export function EventSection({ eventTypes, readOnly }: EventSectionProps) {
  const { t } = useTranslation('quotes');
  const { state, setFields } = useQuoteBuilder();
  const { data: config } = useConfig();
  const isDesktop = useIsDesktop();
  const [form] = Form.useForm<EventFormValues>();
  const eventDate = Form.useWatch('eventDate', form);
  const selectedState = Form.useWatch('state', form);

  const cityOptions = (selectedState ? (CITIES_BY_STATE_MAP[selectedState] ?? []) : []).map(
    (city) => ({ value: city, label: city }),
  );

  const stateTaxRate = selectedState
    ? (config?.stateSettings.find((s) => s.state === selectedState)?.taxRate ?? 0)
    : 0;

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
    longDistanceAmount: state.longDistanceAmount / 100,
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
      form.setFieldValue('longDistanceAmount', suggestedLongDistance / 100);
    }
    if ('city' in changed) patch.city = changed.city ?? '';
    if ('address' in changed) patch.address = changed.address ?? '';
    if ('longDistanceAmount' in changed) {
      patch.longDistanceAmount = Math.round((changed.longDistanceAmount ?? 0) * 100);
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
    <Form.Item name="eventDate" label={<FieldLabel title={t('builder.event.date')} />}>
      <DatePicker className="w-full" disabledDate={disabledDate} />
    </Form.Item>
  );

  const eventTimeField = (
    <Form.Item name="eventTime" label={<FieldLabel title={t('builder.event.time')} />}>
      <TimePicker
        className="w-full"
        format="HH:mm"
        minuteStep={15}
        needConfirm={false}
        showNow={false}
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

  const longDistanceField = (
    <Form.Item
      name="longDistanceAmount"
      label={<FieldLabel title={t('builder.event.longDistance')} />}
      extra={
        selectedState
          ? t('builder.event.longDistanceHint', { rate: Math.round(stateTaxRate * 1000) / 10 })
          : undefined
      }
      className="sm:max-w-56"
    >
      <InputNumber className="w-full" min={0} precision={2} prefix="$" />
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
    >
      {isDesktop ? (
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          {eventTypeField}
          {eventDateField}
          {eventTimeField}
          {stateField}
          {cityField}
        </div>
      ) : (
        <div className="mb-4">
          <Card size="small">
            <Typography.Title level={4} className="font-heading text-brown m-0!">
              {t('builder.event.eventDetailsGroupTitle')}
            </Typography.Title>

            <div className="mt-4">
              {eventTypeField}
              {eventDateField}
              {eventTimeField}
            </div>
          </Card>
        </div>
      )}

      {isDesktop ? (
        addressField
      ) : (
        <div className="mb-4">
          <Card size="small">
            <Typography.Title level={4} className="font-heading text-brown m-0!">
              {t('builder.event.addressGroupTitle')}
            </Typography.Title>

            <div className="mt-4">
              {stateField}
              {cityField}
              {addressField}
            </div>
          </Card>
        </div>
      )}

      {isDesktop && longDistanceField}
    </Form>
  );
}
