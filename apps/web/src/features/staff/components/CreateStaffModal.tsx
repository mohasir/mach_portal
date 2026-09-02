'use client';
import { useTranslation } from 'react-i18next';
import type { CreateStaffInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useCreateStaff } from '../hooks/useStaff';
import { StaffForm } from './StaffForm';

interface CreateStaffModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateStaffModal({ open, onClose }: CreateStaffModalProps) {
  const { t } = useTranslation('staff');
  const { createStaff, isPending } = useCreateStaff();

  const onSubmit = async (values: CreateStaffInput) => {
    try {
      await createStaff(values);
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('create.title')}>
      {open && <StaffForm onSubmit={onSubmit} isPending={isPending} />}
    </WrapperModal>
  );
}
