'use client';
import { useTranslation } from 'react-i18next';
import type { CreateRescheduleReasonInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useUpdateRescheduleReason } from '../hooks/useRescheduleReasons';
import { RescheduleReasonForm } from './RescheduleReasonForm';
import type { RescheduleReason } from '../types';

interface EditRescheduleReasonModalProps {
  reason: RescheduleReason | null;
  open: boolean;
  onClose: () => void;
}

export function EditRescheduleReasonModal({
  reason,
  open,
  onClose,
}: EditRescheduleReasonModalProps) {
  const { t } = useTranslation('rescheduleReasons');
  const { updateRescheduleReason, isPending } = useUpdateRescheduleReason();

  const onSubmit = async (values: CreateRescheduleReasonInput) => {
    if (!reason) return;
    try {
      await updateRescheduleReason(reason.id, values);
      onClose();
    } catch {
      // Surfaced by useApiError.
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('edit.title')}>
      {reason && (
        <RescheduleReasonForm
          key={reason.id}
          initialValues={{ name: reason.name, requiresNote: reason.requiresNote }}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </WrapperModal>
  );
}
