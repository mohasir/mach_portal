'use client';
import { DatePicker, Form, Input, Select, TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { stateSchema, type StateValue } from '@repo/schemas';
import type { EventType } from '@/features/event-types';
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
  address?: string;
  notes?: string;
}

export function EventSection({ eventTypes, readOnly }: EventSectionProps) {
  const { t } = useTranslation('quotes');
  const { state, setFields } = useQuoteBuilder();

  const initialValues: EventFormValues = {
    eventTypeId: state.eventTypeId ?? undefined,
    eventDate: state.eventDate ? dayjs(state.eventDate) : undefined,
    eventTime: state.eventTime ? dayjs(state.eventTime, 'HH:mm') : undefined,
    state: state.state ?? undefined,
    address: state.address,
    notes: state.notes,
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
    if ('state' in changed) patch.state = changed.state ?? null;
    if ('address' in changed) patch.address = changed.address ?? '';
    if ('notes' in changed) patch.notes = changed.notes ?? '';
    setFields(patch);
  };

  return (
    <Form<EventFormValues>
      layout="vertical"
      disabled={readOnly}
      initialValues={initialValues}
      onValuesChange={handleValuesChange}
      requiredMark={false}
    >
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <Form.Item name="eventTypeId" label={t('builder.event.type')}>
          <Select
            allowClear
            placeholder={t('builder.event.typePlaceholder')}
            options={eventTypes.map((e) => ({ value: e.id, label: e.name }))}
          />
        </Form.Item>
        <Form.Item name="state" label={t('builder.event.state')} required>
          <Select
            allowClear
            placeholder={t('builder.event.statePlaceholder')}
            options={stateSchema.options.map((s) => ({ value: s, label: s }))}
          />
        </Form.Item>
        <Form.Item name="eventDate" label={t('builder.event.date')}>
          <DatePicker className="w-full" />
        </Form.Item>
        <Form.Item name="eventTime" label={t('builder.event.time')}>
          <TimePicker className="w-full" format="HH:mm" minuteStep={15} />
        </Form.Item>
      </div>
      <Form.Item name="address" label={t('builder.event.address')} required>
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 3 }}
          placeholder={t('builder.event.addressPlaceholder')}
        />
      </Form.Item>
      <Form.Item name="notes" label={t('builder.event.notes')}>
        <Input.TextArea
          autoSize={{ minRows: 2, maxRows: 4 }}
          placeholder={t('builder.event.notesPlaceholder')}
        />
      </Form.Item>
    </Form>
  );
}
