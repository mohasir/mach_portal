'use client';
import { Button, Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateOptionInput } from '@repo/schemas';

interface OptionFormProps {
  initialValues?: Partial<UpdateOptionInput>;
  onSubmit: (values: UpdateOptionInput) => Promise<void> | void;
  isPending: boolean;
}

export function OptionForm({ initialValues, onSubmit, isPending }: OptionFormProps) {
  const { t } = useTranslation('catalog');
  const [form] = Form.useForm<UpdateOptionInput>();

  return (
    <Form form={form} layout="vertical" initialValues={initialValues} onFinish={onSubmit} requiredMark={false}>
      <Form.Item
        name="name"
        label={t('option.form.name')}
        rules={[{ required: true, message: t('validation.nameRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('option.form.namePlaceholder')} />
      </Form.Item>

      <Form.Item name="description" label={t('option.form.description')} rules={[{ max: 300 }]}>
        <Input.TextArea
          placeholder={t('option.form.descriptionPlaceholder')}
          autoSize={{ minRows: 1, maxRows: 3 }}
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
