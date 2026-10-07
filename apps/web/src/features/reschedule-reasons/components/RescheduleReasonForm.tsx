'use client';
import { Button, Form, Input, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateRescheduleReasonInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';

interface RescheduleReasonFormProps {
  initialValues?: Partial<CreateRescheduleReasonInput>;
  onSubmit: (values: CreateRescheduleReasonInput) => Promise<void> | void;
  isPending: boolean;
}

export function RescheduleReasonForm({
  initialValues,
  onSubmit,
  isPending,
}: RescheduleReasonFormProps) {
  const { t } = useTranslation('rescheduleReasons');
  const [form] = Form.useForm<CreateRescheduleReasonInput>();

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ requiresNote: false, ...initialValues }}
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
        name="requiresNote"
        label={<FieldLabel title={t('form.requiresNote')} />}
        extra={t('form.requiresNoteHint')}
        valuePropName="checked"
      >
        <Switch />
      </Form.Item>

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>
          {t('form.save')}
        </Button>
      </Form.Item>
    </Form>
  );
}
