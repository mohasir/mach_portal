'use client';
import { Form, Input, Switch, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import type { PriceTierInput, UpdateProductInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { SwitchRow } from '@/components/shared/Inputs/SwitchRow';

export interface ProductFormValues {
  name: string;
  description?: string;
  isPremium: boolean;
}

interface ProductFormProps {
  form: FormInstance<ProductFormValues>;
  initialValues?: Partial<ProductFormValues>;
  tiers?: PriceTierInput[];
  onSubmit: (values: UpdateProductInput) => Promise<void> | void;
}

export function ProductForm({ form, initialValues, tiers = [], onSubmit }: ProductFormProps) {
  const { t } = useTranslation('catalog');

  const handleFinish = (values: ProductFormValues) =>
    onSubmit({
      name: values.name,
      description: values.description,
      isPremium: values.isPremium ?? false,
      tiers,
    });

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ isPremium: false, ...initialValues }}
      onFinish={handleFinish}
      requiredMark={false}
    >
      <Form.Item
        name="name"
        label={<FieldLabel title={t('product.form.name')} required />}
        rules={[{ required: true, message: t('validation.nameRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('product.form.namePlaceholder')} />
      </Form.Item>

      <Form.Item
        name="description"
        label={<FieldLabel title={t('product.form.description')} />}
        rules={[{ max: 500 }]}
      >
        <Input.TextArea
          placeholder={t('product.form.descriptionPlaceholder')}
          autoSize={{ minRows: 2, maxRows: 4 }}
        />
      </Form.Item>

      <SwitchRow
        title={t('product.form.isPremium')}
        control={
          <Form.Item name="isPremium" valuePropName="checked" noStyle>
            <Switch />
          </Form.Item>
        }
      />
    </Form>
  );
}
