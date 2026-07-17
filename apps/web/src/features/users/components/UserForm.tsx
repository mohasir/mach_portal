'use client';
import { Button, Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { ROLES } from '@repo/guards';
import type { CreateUserInput } from '@repo/schemas';

interface UserFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<CreateUserInput>;
  onSubmit: (values: CreateUserInput) => Promise<void> | void;
  isPending: boolean;
}

export function UserForm({ mode, initialValues, onSubmit, isPending }: UserFormProps) {
  const { t } = useTranslation('users');
  const [form] = Form.useForm<CreateUserInput>();

  const roleOptions = Object.values(ROLES)
    .filter((role) => role !== ROLES.SUPERADMIN)
    .map((role) => ({ value: role, label: t(`roles.${role}`) }));

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

      {mode === 'create' && (
        <>
          <Form.Item
            name="email"
            label={t('form.email')}
            rules={[
              { required: true, message: t('validation.emailInvalid') },
              { type: 'email', message: t('validation.emailInvalid') },
            ]}
          >
            <Input placeholder={t('form.emailPlaceholder')} />
          </Form.Item>

          <Form.Item
            name="password"
            label={t('form.password')}
            rules={[
              { required: true, message: t('validation.passwordMin') },
              { min: 8, message: t('validation.passwordMin') },
            ]}
          >
            <Input.Password placeholder={t('form.passwordPlaceholder')} />
          </Form.Item>
        </>
      )}

      <Form.Item
        name="role"
        label={t('form.role')}
        rules={[{ required: true, message: t('validation.roleRequired') }]}
      >
        <Select options={roleOptions} placeholder={t('form.rolePlaceholder')} />
      </Form.Item>

      <Form.Item className="mb-0">
        <Button type="primary" htmlType="submit" loading={isPending} block>
          {t('form.save')}
        </Button>
      </Form.Item>
    </Form>
  );
}
