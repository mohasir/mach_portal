'use client';
import { Form, Input, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import type { EventType } from '@/features/event-types';
import { useLocationSettings } from '@/features/settings';
import { LocationFields } from '@/components/shared/LocationFields';
import {
  formatPlace,
  isLocationActive,
  isPlaceStale,
} from '@/components/shared/LocationFields/helpers';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { WrapperDatePicker } from '@/components/shared/WrapperDatePicker';
import { WrapperTimePicker } from '@/components/shared/WrapperTimePicker';
import { disabledPastDate, disabledPastTime } from '@/lib/date';
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
  address?: string;
}

export function EventSection({ eventTypes, readOnly, quoteId }: EventSectionProps) {
  const { t } = useTranslation('quotes');
  const { state, setFields } = useQuoteBuilder();
  const [form] = Form.useForm<EventFormValues>();
  const eventDate = Form.useWatch('eventDate', form);
  const eventTime = Form.useWatch('eventTime', form);
  const { data: locationSettings } = useLocationSettings();
  const locationActive = isLocationActive(locationSettings);
  const askAddress = locationActive && locationSettings.askAddress;
  // A place saved while the function was on stays visible, read-only, once it is off.
  const showAddress = askAddress || state.address.trim().length > 0;
  const asksPlace = locationActive && (locationSettings.depth > 0 || askAddress);
  const showPlaceCard = asksPlace || !!state.region || !!state.locality || showAddress;
  const placeIsStale = isPlaceStale(locationSettings, state.country);

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

  const initialValues: EventFormValues = {
    eventTypeId: state.eventTypeId ?? undefined,
    eventDate: state.eventDate ? dayjs(state.eventDate) : undefined,
    eventTime: state.eventTime ? dayjs(state.eventTime, 'HH:mm') : undefined,
    address: state.address,
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
    if ('address' in changed) patch.address = changed.address ?? '';
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
      <WrapperDatePicker
        className="w-full"
        sheetTitle={t('builder.event.date')}
        disabledDate={disabledPastDate}
      />
    </Form.Item>
  );

  const eventTimeField = (
    <Form.Item
      name="eventTime"
      label={<FieldLabel title={t('builder.event.time')} />}
      hasFeedback={!!availabilityStatus}
      validateStatus={availabilityStatus}
    >
      <WrapperTimePicker
        className="w-full"
        sheetTitle={t('builder.event.time')}
        minuteStep={15}
        classNames={{ popup: { content: 'min-w-[150px]' } }}
        disabledTime={disabledPastTime(eventDate)}
      />
    </Form.Item>
  );

  const addressField = (
    <Form.Item
      name="address"
      label={<FieldLabel title={t('builder.event.address')} required={askAddress} />}
      required={askAddress}
    >
      <Input.TextArea
        disabled={!askAddress}
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

      {showPlaceCard && (
        <WrapperCard title={t('builder.event.addressGroupTitle')}>
          {placeIsStale && (
            <WrapperAlert
              type="warning"
              closeable={false}
              className="mb-4"
              description={t('builder.event.placeStale', {
                place: formatPlace(state.country, state.region, state.locality) || '—',
              })}
            />
          )}
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <LocationFields
              settings={locationSettings}
              value={
                placeIsStale
                  ? { region: null, locality: null }
                  : { region: state.region, locality: state.locality }
              }
              onChange={(place) =>
                // Picking a place stamps the configured country, which clears the stale state.
                setFields({ ...place, country: locationSettings?.country ?? state.country })
              }
              readOnly={readOnly}
              storedCountry={state.country}
            />
            {showAddress && <div className="sm:col-span-2">{addressField}</div>}
          </div>
        </WrapperCard>
      )}
    </Form>
  );
}
