'use client';
import { Button, Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateEventTypeInput } from '@repo/schemas';
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
    <Form form={form} layout="vertical" initialValues={initialValues} onFinish={onSubmit} requiredMark={false}>
      <Form.Item
        name="name"
        label={<FieldLabel title={t('form.name')} required />}
        rules={[{ required: true, message: t('validation.nameRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('form.namePlaceholder')} />
      </Form.Item>

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>
          {t('form.save')}
        </Button>
      </Form.Item>
    </Form>
  );
}
