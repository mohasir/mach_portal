'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateUserInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useCreateUser } from '../hooks/useUsers';
import { ExistingAccountAddedResult } from './ExistingAccountAddedResult';
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
  // `url` is null when the email already had an account: it was only added to the organization.
  const [setup, setSetup] = useState<{ url: string | null; name: string; email: string } | null>(
    null,
  );

  const handleClose = () => {
    setSetup(null);
    onClose();
  };

  const onSubmit = async (values: CreateUserInput) => {
    try {
      const { user, setupUrl } = await createUser(values);
      setSetup({ url: setupUrl, name: user.name, email: user.email });
    } catch {
      // error notificado por useApiError
    }
  };

  const renderContent = () => {
    if (!setup) return <UserForm mode="create" onSubmit={onSubmit} isPending={isPending} />;
    if (!setup.url) return <ExistingAccountAddedResult email={setup.email} onClose={handleClose} />;
    return (
      <PasswordSetupLinkResult
        url={setup.url}
        name={setup.name}
        email={setup.email}
        variant="create"
      />
    );
  };

  return (
    <WrapperModal
      open={open}
      onCancel={handleClose}
      title={setup?.url ? tc('share.action') : t('create.title')}
      width={setup ? { xs: '90%', md: 340 } : undefined}
      classNames={setup ? { title: 'text-2xl' } : undefined}
    >
      {open && renderContent()}
    </WrapperModal>
  );
}
