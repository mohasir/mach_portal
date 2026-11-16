'use client';
import { Form, Input, Switch, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import type { PriceTierInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { MoneyInput } from '@/components/shared/Inputs/MoneyInput';
import { SwitchRow } from '@/components/shared/Inputs/SwitchRow';
import { useFeature } from '@/lib/auth/useFeature';
import { buildProductPayload, type ProductFormValues, type ProductPayload } from '../helpers';

interface ProductFormProps {
  form: FormInstance<ProductFormValues>;
  initialValues?: Partial<ProductFormValues>;
  tiers?: PriceTierInput[];
  onSubmit: (values: ProductPayload) => Promise<void> | void;
}

export function ProductForm({ form, initialValues, tiers = [], onSubmit }: ProductFormProps) {
  const { t } = useTranslation('catalog');
  const vocabulary = useCatalogVocabulary();
  const priceTiersEnabled = useFeature('priceTiers');

  const handleFinish = (values: ProductFormValues) =>
    onSubmit(buildProductPayload(values, { tiers, priceTiersEnabled }));

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
        <Input placeholder={t('product.form.namePlaceholder', vocabulary)} />
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
        name="price"
        label={<FieldLabel title={t('product.form.price')} />}
        extra={t('product.form.priceCaption')}
        rules={[{ type: 'number', min: 0, message: t('validation.priceInvalid') }]}
      >
        <MoneyInput min={0} step={5} className="w-full" placeholder="0.00" />
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
