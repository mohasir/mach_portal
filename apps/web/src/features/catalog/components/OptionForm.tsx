'use client';
import { Form, Input, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateOptionInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';

interface OptionFormProps {
  form: FormInstance<UpdateOptionInput>;
  initialValues?: Partial<UpdateOptionInput>;
  onSubmit: (values: UpdateOptionInput) => Promise<void> | void;
}

export function OptionForm({ form, initialValues, onSubmit }: OptionFormProps) {
  const { t } = useTranslation('catalog');

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onSubmit}
      requiredMark={false}
    >
      <Form.Item
        name="name"
        label={<FieldLabel title={t('option.form.name')} required />}
        rules={[{ required: true, message: t('validation.nameRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('option.form.namePlaceholder')} />
      </Form.Item>

      <Form.Item
        name="description"
        label={<FieldLabel title={t('option.form.description')} />}
        rules={[{ max: 300 }]}
        className="mb-0"
      >
        <Input.TextArea
          placeholder={t('option.form.descriptionPlaceholder')}
          autoSize={{ minRows: 1, maxRows: 3 }}
        />
      </Form.Item>
    </Form>
  );
}
