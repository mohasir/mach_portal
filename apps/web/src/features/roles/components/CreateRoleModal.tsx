'use client';
import { useState } from 'react';
import { App, Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { WrapperAlert } from '@/components/shared/WrapperAlert';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { usePermissions } from '@/features/tenant';
import { useCreateRole } from '../hooks/useRoles';
import { ROLE_MODAL_WIDTH } from '../helpers';
import { resolveSubmitError } from '../lib/roleErrors';
import { buildCreatePayload, initialFormState, type RoleFormState } from '../lib/roleForm';
import { RoleForm } from './RoleForm';

interface CreateRoleModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateRoleModal({ open, onClose }: CreateRoleModalProps) {
  const { t } = useTranslation('roles');

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('create.title')} width={ROLE_MODAL_WIDTH}>
      {open && <CreateRoleContent onClose={onClose} />}
    </WrapperModal>
  );
}

function CreateRoleContent({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('roles');
  const { t: ta } = useTranslation('api');
  const { message } = App.useApp();
  const { access } = usePermissions();
  const [form] = Form.useForm<RoleFormState>();
  const { createRole, isPending } = useCreateRole(form);
  const [initial] = useState(() => initialFormState());
  const [noticeCode, setNoticeCode] = useState<string | null>(null);

  const onSubmit = async (values: RoleFormState) => {
    setNoticeCode(null);
    try {
      await createRole(buildCreatePayload(values));
      message.success(t('form.saved'));
      onClose();
    } catch (error) {
      const outcome = resolveSubmitError(error);
      if (outcome.kind === 'nameTaken') {
        form.setFields([{ name: 'name', errors: [ta('errors.ROLE_NAME_TAKEN')] }]);
      }
      if (outcome.kind === 'notice') setNoticeCode(outcome.code);
    }
  };

  return (
    <RoleForm
      form={form}
      initialValues={initial}
      actorAccess={access}
      notices={
        noticeCode && (
          <WrapperAlert
            key={noticeCode}
            type="error"
            onClose={() => setNoticeCode(null)}
            description={ta(`errors.${noticeCode}`, ta('errors.generic'))}
          />
        )
      }
      onSubmit={onSubmit}
      isPending={isPending}
    />
  );
}
