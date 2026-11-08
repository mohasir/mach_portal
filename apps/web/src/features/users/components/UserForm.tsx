'use client';
import { Button, Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateUserInput } from '@repo/schemas';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import { roleLabel } from '@/lib/auth/roleLabel';
import { toRoleOptions } from '../helpers';
import { useAssignableRoles } from '../hooks/useUsers';
import type { User } from '../types';

interface UserFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<CreateUserInput>;
  onSubmit: (values: CreateUserInput) => Promise<void> | void;
  isPending: boolean;
  /** Role the edited member holds now. */
  currentRole?: User['role'];
}

export function UserForm({ mode, initialValues, onSubmit, isPending, currentRole }: UserFormProps) {
  const { t } = useTranslation('users');
  const [form] = Form.useForm<CreateUserInput>();

  const { data: roles, isLoading: rolesLoading } = useAssignableRoles();
  const roleOptions = toRoleOptions(roles, (role) => roleLabel(role, t), currentRole);

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
        label={<FieldLabel title={t('form.name')} required />}
        rules={[{ required: true, message: t('validation.nameRequired') }, { max: 120 }]}
      >
        <Input placeholder={t('form.namePlaceholder')} />
      </Form.Item>

      {mode === 'create' && (
        <Form.Item
          name="email"
          label={<FieldLabel title={t('form.email')} required />}
          rules={[
            { required: true, message: t('validation.emailInvalid') },
            { type: 'email', message: t('validation.emailInvalid') },
          ]}
        >
          <Input placeholder={t('form.emailPlaceholder')} />
        </Form.Item>
      )}

      <Form.Item
        name="roleId"
        label={<FieldLabel title={t('form.role')} required />}
        rules={[{ required: true, message: t('validation.roleRequired') }]}
      >
        <Select
          options={roleOptions}
          loading={rolesLoading}
          placeholder={t('form.rolePlaceholder')}
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
