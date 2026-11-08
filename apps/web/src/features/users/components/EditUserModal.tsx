'use client';
import { useTranslation } from 'react-i18next';
import type { CreateUserInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useUpdateUser } from '../hooks/useUsers';
import { UserForm } from './UserForm';
import type { User } from '../types';

interface EditUserModalProps {
  user: User | null;
  open: boolean;
  onClose: () => void;
}

export function EditUserModal({ user, open, onClose }: EditUserModalProps) {
  const { t } = useTranslation('users');
  const { updateUser, isPending } = useUpdateUser();

  const onSubmit = async (values: CreateUserInput) => {
    if (!user) return;
    try {
      await updateUser(user.id, { name: values.name, roleId: values.roleId });
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('edit.title')}>
      {user && (
        <UserForm
          key={user.id}
          mode="edit"
          initialValues={{
            name: user.name,
            roleId: user.role.id,
          }}
          onSubmit={onSubmit}
          isPending={isPending}
          currentRole={user.role}
        />
      )}
    </WrapperModal>
  );
}
