'use client';
import { Button, Form, Input, InputNumber, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import type { UpdateProductInput } from '@repo/schemas';

// Local form shape: price is captured in USD and converted to cents only here, at
// the form boundary (docs/mach-bar-domain.md §3) — the rest of the app deals in cents.
interface ProductFormValues {
  name: string;
  description?: string;
  basePriceUsd: number;
  isPremium: boolean;
}

interface ProductFormProps {
  initialValues?: Partial<ProductFormValues>;
  onSubmit: (values: UpdateProductInput) => Promise<void> | void;
  isPending: boolean;
}

export function ProductForm({ initialValues, onSubmit, isPending }: ProductFormProps) {
  const { t } = useTranslation('catalog');
  const [form] = Form.useForm<ProductFormValues>();

  const handleFinish = (values: ProductFormValues) =>
    onSubmit({
      name: values.name,
      description: values.description,
      basePrice: Math.round(values.basePriceUsd * 100),
      isPremium: values.isPremium ?? false,
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
        label={t('product.form.name')}
        rules={[{ required: true, message: t('validation.nameRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('product.form.namePlaceholder')} />
      </Form.Item>

      <Form.Item name="description" label={t('product.form.description')} rules={[{ max: 500 }]}>
        <Input.TextArea
          placeholder={t('product.form.descriptionPlaceholder')}
          autoSize={{ minRows: 2, maxRows: 4 }}
        />
      </Form.Item>

      <Form.Item
        name="basePriceUsd"
        label={t('product.form.basePrice')}
        rules={[{ required: true, message: t('validation.basePriceInvalid') }]}
      >
        <InputNumber min={0} step={0.5} precision={2} prefix="$" className="w-full" placeholder="0.00" />
      </Form.Item>

      <Form.Item name="isPremium" label={t('product.form.isPremium')} valuePropName="checked">
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
