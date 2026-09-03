'use client';
import { useTranslation } from 'react-i18next';
import type { CreateStaffInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useUpdateStaff } from '../hooks/useStaff';
import { StaffForm } from './StaffForm';
import type { Staff } from '../types';

interface EditStaffModalProps {
  member: Staff | null;
  open: boolean;
  onClose: () => void;
}

export function EditStaffModal({ member, open, onClose }: EditStaffModalProps) {
  const { t } = useTranslation('staff');
  const { updateStaff, isPending } = useUpdateStaff();

  const onSubmit = async (values: CreateStaffInput) => {
    if (!member) return;
    try {
      await updateStaff(member.id, values);
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('edit.title')}>
      {member && (
        <StaffForm
          key={member.id}
          initialValues={{
            name: member.name,
            email: member.email ?? undefined,
            phone: member.phone ?? undefined,
            isActive: member.isActive,
          }}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </WrapperModal>
  );
}
