'use client';
import { Button, Form, Input, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateOptionGroupInput } from '@repo/schemas';

interface OptionGroupFormProps {
  initialValues?: Partial<UpdateOptionGroupInput>;
  onSubmit: (values: UpdateOptionGroupInput) => Promise<void> | void;
  isPending: boolean;
}

export function OptionGroupForm({ initialValues, onSubmit, isPending }: OptionGroupFormProps) {
  const { t } = useTranslation('catalog');
  const [form] = Form.useForm<UpdateOptionGroupInput>();

  return (
    <Form form={form} layout="vertical" initialValues={initialValues} onFinish={onSubmit} requiredMark={false}>
      <Form.Item
        name="label"
        label={t('optionGroup.form.label')}
        rules={[{ required: true, message: t('validation.labelRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('optionGroup.form.labelPlaceholder')} />
      </Form.Item>

      <Form.Item name="maxSelect" label={t('optionGroup.form.maxSelect')}>
        <InputNumber min={1} className="w-full" placeholder={t('optionGroup.form.maxSelectPlaceholder')} />
      </Form.Item>

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>
          {t('form.save')}
        </Button>
      </Form.Item>
    </Form>
  );
}
