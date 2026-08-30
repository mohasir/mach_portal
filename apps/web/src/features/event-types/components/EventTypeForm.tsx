'use client';
import { Button, ColorPicker, Form, Input } from 'antd';
import type { Color } from 'antd/es/color-picker';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_EVENT_TYPE_COLOR,
  EVENT_TYPE_COLOR_PRESETS,
  type CreateEventTypeInput,
} from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';

interface EventTypeFormProps {
  initialValues?: Partial<CreateEventTypeInput>;
  onSubmit: (values: CreateEventTypeInput) => Promise<void> | void;
  isPending: boolean;
}

export function EventTypeForm({ initialValues, onSubmit, isPending }: EventTypeFormProps) {
  const { t } = useTranslation('eventTypes');
  const [form] = Form.useForm<CreateEventTypeInput>();

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ color: DEFAULT_EVENT_TYPE_COLOR, ...initialValues }}
      onFinish={onSubmit}
      requiredMark={false}
    >
      <Form.Item
        name="name"
        label={<FieldLabel title={t('form.name')} required />}
        rules={[{ required: true, message: t('validation.nameRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('form.namePlaceholder')} />
      </Form.Item>

      <Form.Item
        name="color"
        label={<FieldLabel title={t('form.color')} />}
        getValueFromEvent={(colorValue: Color) => colorValue.toHexString()}
      >
        <ColorPicker
          presets={[{ label: t('form.colorPresets'), colors: [...EVENT_TYPE_COLOR_PRESETS] }]}
          disabledAlpha
          format="hex"
          disabledFormat
          className="h-8 w-16"
          classNames={{ body: 'w-full h-full' }}
        />
      </Form.Item>

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>
          {t('form.save')}
        </Button>
      </Form.Item>
    </Form>
  );
}
