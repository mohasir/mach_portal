'use client';
import { Button, Form, Input, Select, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import { stateSchema, type CreateClientInput } from '@repo/schemas';

interface ClientFormProps {
  form: FormInstance<CreateClientInput>;
  initialValues?: Partial<CreateClientInput>;
  onSubmit: (values: CreateClientInput) => Promise<void> | void;
  isPending: boolean;
}

const stateOptions = stateSchema.options.map((state) => ({ value: state, label: state }));

export function ClientForm({ form, initialValues, onSubmit, isPending }: ClientFormProps) {
  const { t } = useTranslation('clients');

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
        label={t('form.name')}
        rules={[{ required: true, message: t('validation.nameRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('form.namePlaceholder')} />
      </Form.Item>

      <Form.Item
        name="email"
        label={t('form.email')}
        rules={[{ type: 'email', message: t('validation.emailInvalid') }]}
      >
        <Input placeholder={t('form.emailPlaceholder')} />
      </Form.Item>

      <Form.Item name="phone" label={t('form.phone')} rules={[{ max: 40 }]}>
        <Input placeholder={t('form.phonePlaceholder')} />
      </Form.Item>

      <Form.Item name="city" label={t('form.city')} rules={[{ max: 120 }]}>
        <Input placeholder={t('form.cityPlaceholder')} />
      </Form.Item>

      <Form.Item name="state" label={t('form.state')}>
        <Select options={stateOptions} placeholder={t('form.statePlaceholder')} allowClear />
      </Form.Item>

      <Form.Item name="address" label={t('form.address')} rules={[{ max: 240 }]}>
        <Input.TextArea
          placeholder={t('form.addressPlaceholder')}
          autoSize={{ minRows: 1, maxRows: 3 }}
        />
      </Form.Item>

      <Form.Item name="notes" label={t('form.notes')} rules={[{ max: 2000 }]}>
        <Input.TextArea
          placeholder={t('form.notesPlaceholder')}
          autoSize={{ minRows: 2, maxRows: 5 }}
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
