'use client';
import { Button, Form, Input, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateStaffInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { PhoneInput } from '@/components/shared/Inputs/PhoneInput';

interface StaffFormProps {
  initialValues?: Partial<CreateStaffInput>;
  onSubmit: (values: CreateStaffInput) => Promise<void> | void;
  isPending: boolean;
}

export function StaffForm({ initialValues, onSubmit, isPending }: StaffFormProps) {
  const { t } = useTranslation('staff');
  const [form] = Form.useForm<CreateStaffInput>();

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ isActive: true, ...initialValues }}
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
        name="email"
        label={<FieldLabel title={t('form.email')} />}
        rules={[{ type: 'email', message: t('validation.emailInvalid') }]}
      >
        <Input placeholder={t('form.emailPlaceholder')} />
      </Form.Item>

      <Form.Item name="phone" label={<FieldLabel title={t('form.phone')} />} rules={[{ max: 40 }]}>
        <PhoneInput placeholder={t('form.phonePlaceholder')} />
      </Form.Item>

      <Form.Item
        name="isActive"
        label={<FieldLabel title={t('form.isActive')} />}
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
