'use client';
import { Button, Form, Input, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import type { PriceTierInput, UpdateProductInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';

interface ProductFormValues {
  name: string;
  description?: string;
  isPremium: boolean;
}

interface ProductFormProps {
  initialValues?: Partial<ProductFormValues>;
  tiers?: PriceTierInput[];
  onSubmit: (values: UpdateProductInput) => Promise<void> | void;
  isPending: boolean;
}

export function ProductForm({ initialValues, tiers = [], onSubmit, isPending }: ProductFormProps) {
  const { t } = useTranslation('catalog');
  const [form] = Form.useForm<ProductFormValues>();

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

      <Form.Item
        name="isPremium"
        label={<FieldLabel title={t('product.form.isPremium')} />}
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
