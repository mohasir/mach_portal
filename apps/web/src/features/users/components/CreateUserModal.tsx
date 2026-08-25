'use client';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateUserInput } from '@repo/schemas';
import { useCreateUser } from '../hooks/useUsers';
import { UserForm } from './UserForm';

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const { t } = useTranslation('users');
  const { createUser, isPending } = useCreateUser();

  const onSubmit = async (values: CreateUserInput) => {
    try {
      await createUser(values);
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('create.title')}>
      {open && <UserForm mode="create" onSubmit={onSubmit} isPending={isPending} />}
    </Modal>
  );
}
