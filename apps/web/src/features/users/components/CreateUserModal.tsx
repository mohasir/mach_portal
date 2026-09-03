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
  const [setup, setSetup] = useState<{ url: string; name: string; email: string } | null>(null);

  const handleClose = () => {
    setSetup(null);
    onClose();
  };

  const onSubmit = async (values: CreateUserInput) => {
    try {
      const { setupUrl } = await createUser(values);
      setSetup({ url: setupUrl, name: values.name, email: values.email });
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <WrapperModal
      open={open}
      onCancel={handleClose}
      title={setup ? tc('share.action') : t('create.title')}
      width={setup ? { xs: '90%', md: 340 } : undefined}
      classNames={setup ? { title: 'text-2xl' } : undefined}
    >
      {open &&
        (setup ? (
          <PasswordSetupLinkResult
            url={setup.url}
            name={setup.name}
            email={setup.email}
            variant="create"
          />
        ) : (
          <UserForm mode="create" onSubmit={onSubmit} isPending={isPending} />
        ))}
    </WrapperModal>
  );
}
