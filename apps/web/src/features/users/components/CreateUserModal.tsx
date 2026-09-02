'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateUserInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useCreateUser } from '../hooks/useUsers';
import { PasswordSetupLinkResult } from './PasswordSetupLinkResult';
import { UserForm } from './UserForm';

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { createUser, isPending } = useCreateUser();
  const [setupUrl, setSetupUrl] = useState<string | null>(null);

  const handleClose = () => {
    setSetupUrl(null);
    onClose();
  };

  const onSubmit = async (values: CreateUserInput) => {
    try {
      const { setupUrl } = await createUser(values);
      setSetupUrl(setupUrl);
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <WrapperModal
      open={open}
      onCancel={handleClose}
      title={setupUrl ? tc('share.action') : t('create.title')}
      width={setupUrl ? { xs: '90%', md: 340 } : undefined}
      classNames={setupUrl ? { title: 'text-2xl' } : undefined}
    >
      {open &&
        (setupUrl ? (
          <PasswordSetupLinkResult url={setupUrl} variant="create" />
        ) : (
          <UserForm mode="create" onSubmit={onSubmit} isPending={isPending} />
        ))}
    </WrapperModal>
  );
}
