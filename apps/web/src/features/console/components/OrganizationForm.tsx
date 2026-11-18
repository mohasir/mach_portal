'use client';
import { Button, Form, Input, Radio, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import { CATALOG_KINDS, DEFAULT_CATALOG_KIND, type CreateOrganizationInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';

export function OrganizationForm({
  form,
  onSubmit,
  isPending,
}: {
  form: FormInstance<CreateOrganizationInput>;
  onSubmit: (values: CreateOrganizationInput) => Promise<void> | void;
  isPending: boolean;
}) {
  const { t } = useTranslation('console');

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ catalogKind: DEFAULT_CATALOG_KIND }}
      onFinish={onSubmit}
      requiredMark={false}
    >
      <Form.Item
        name="slug"
        label={
          <FieldLabel title={t('create.form.slug')} caption={t('create.form.slugHint')} required />
        }
        rules={[
          { required: true, whitespace: true, message: t('create.validation.slugRequired') },
          { max: 60 },
        ]}
      >
        <Input autoComplete="off" placeholder={t('create.form.slugPlaceholder')} />
      </Form.Item>

      <Form.Item
        name="name"
        label={<FieldLabel title={t('create.form.name')} required />}
        rules={[
          { required: true, whitespace: true, message: t('create.validation.nameRequired') },
          { max: 120 },
        ]}
      >
        <Input autoComplete="off" placeholder={t('create.form.namePlaceholder')} />
      </Form.Item>

      <Form.Item
        name="adminName"
        label={<FieldLabel title={t('create.form.adminName')} required />}
        rules={[
          { required: true, whitespace: true, message: t('create.validation.adminNameRequired') },
          { max: 120 },
        ]}
      >
        <Input autoComplete="off" />
      </Form.Item>

      <Form.Item
        name="adminEmail"
        label={<FieldLabel title={t('create.form.adminEmail')} required />}
        rules={[
          { required: true, message: t('create.validation.emailRequired') },
          { type: 'email', message: t('create.validation.emailInvalid') },
        ]}
      >
        <Input type="email" autoComplete="off" />
      </Form.Item>

      <Form.Item
        name="catalogKind"
        label={<FieldLabel title={t('create.form.catalogKind')} required />}
      >
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          options={CATALOG_KINDS.map((value) => ({ value, label: t(`vocabulary:${value}.Items`) }))}
        />
      </Form.Item>

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>
          {t('create.form.submit')}
        </Button>
      </Form.Item>
    </Form>
  );
}
