'use client';
import { useTranslation } from 'react-i18next';
import type { CreateUserInput, UserRole } from '@repo/schemas';
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
      await updateUser(user.id, { name: values.name, role: values.role });
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
            role: (user.role ?? undefined) as UserRole | undefined,
          }}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </WrapperModal>
  );
}
