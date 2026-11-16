'use client';
import { Button, Form, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateProductCategoryInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import type { ProductCategory } from '../types';

interface ProductCategoryFormProps {
  category?: ProductCategory;
  onSubmit: (values: CreateProductCategoryInput) => Promise<void> | void;
  isPending: boolean;
}

export function ProductCategoryForm({ category, onSubmit, isPending }: ProductCategoryFormProps) {
  const { t } = useTranslation('productCategories');
  const [form] = Form.useForm<CreateProductCategoryInput>();

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={category ? { name: category.name } : undefined}
      onFinish={onSubmit}
      requiredMark={false}
    >
      <Form.Item
        name="name"
        label={<FieldLabel title={t('form.name')} required />}
        rules={[{ required: true, whitespace: true, message: t('validation.nameRequired') }]}
      >
        <Input maxLength={60} placeholder={t('form.namePlaceholder')} />
      </Form.Item>

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>
          {t('form.save')}
        </Button>
      </Form.Item>
    </Form>
  );
}
