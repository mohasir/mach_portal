'use client';
import type { ReactNode } from 'react';
import { Button, Form, Input, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AccessGrants } from '@repo/guards';
import { FieldLabel } from '@/components/shared/Inputs/FieldLabel';
import type { RoleFormState } from '../lib/roleForm';
import { PermissionMatrix } from './PermissionMatrix';

const NAME_MAX_LENGTH = 60;

interface RoleFormProps {
  form: FormInstance<RoleFormState>;
  initialValues: RoleFormState;
  actorAccess: AccessGrants | null | undefined;
  locked?: boolean;
  readOnly?: boolean;
  /** Why the role cannot be changed, shown before any field. */
  banner?: ReactNode;
  /** Messages shown right above the submit button, where the user is looking when saving. */
  notices?: ReactNode;
  submitDisabled?: boolean;
  onSubmit: (values: RoleFormState) => Promise<void> | void;
  isPending: boolean;
}

export function RoleForm({
  form,
  initialValues,
  actorAccess,
  locked = false,
  readOnly = false,
  banner,
  notices,
  submitDisabled = false,
  onSubmit,
  isPending,
}: RoleFormProps) {
  const { t } = useTranslation('roles');
  const editable = !locked && !readOnly;

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onSubmit}
      requiredMark={false}
      disabled={!editable}
    >
      {banner && <div className="mb-4">{banner}</div>}

      <Form.Item
        name="name"
        label={<FieldLabel title={t('form.name')} required />}
        rules={[
          { required: true, whitespace: true, message: t('validation.nameRequired') },
          { max: NAME_MAX_LENGTH, message: t('validation.nameTooLong') },
        ]}
      >
        <Input placeholder={t('form.namePlaceholder')} maxLength={NAME_MAX_LENGTH} />
      </Form.Item>

      <Form.Item
        name="permissions"
        label={
          <FieldLabel
            title={t('form.permissions')}
            caption={editable ? t('form.permissionsCaption') : undefined}
          />
        }
      >
        <PermissionMatrix actorAccess={actorAccess} locked={locked} readOnly={readOnly} />
      </Form.Item>

      <div className="mb-4 flex flex-col gap-3 empty:hidden">{notices}</div>

      {editable && (
        <Form.Item className="mb-0">
          <Button
            type="primary"
            htmlType="submit"
            loading={isPending}
            disabled={submitDisabled}
            block
          >
            {t('form.save')}
          </Button>
        </Form.Item>
      )}
    </Form>
  );
}
