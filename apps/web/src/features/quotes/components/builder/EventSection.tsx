'use client';
import { DatePicker, Form, Input, Select, TimePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { STATE_NAMES, stateSchema, type StateValue } from '@repo/schemas';
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
}

export function EventSection({ eventTypes, readOnly }: EventSectionProps) {
  const { t } = useTranslation('quotes');
  const { state, setFields } = useQuoteBuilder();
  const [form] = Form.useForm<EventFormValues>();
  const eventDate = Form.useWatch('eventDate', form);

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
    if ('state' in changed) patch.state = changed.state ?? null;
    if ('address' in changed) patch.address = changed.address ?? '';
    setFields(patch);
  };

  return (
    <Form<EventFormValues>
      form={form}
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
            options={stateSchema.options.map((s) => ({ value: s, label: STATE_NAMES[s] }))}
          />
        </Form.Item>
        <Form.Item name="eventDate" label={t('builder.event.date')}>
          <DatePicker className="w-full" disabledDate={disabledDate} />
        </Form.Item>
        <Form.Item name="eventTime" label={t('builder.event.time')}>
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
      </div>
      <Form.Item name="address" label={t('builder.event.address')} required>
        <Input.TextArea
          autoSize={{ minRows: 1, maxRows: 3 }}
          placeholder={t('builder.event.addressPlaceholder')}
        />
      </Form.Item>
    </Form>
  );
}
