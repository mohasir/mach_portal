'use client';
import { useTranslation } from 'react-i18next';
import type { CreateRescheduleReasonInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useCreateRescheduleReason } from '../hooks/useRescheduleReasons';
import { RescheduleReasonForm } from './RescheduleReasonForm';

interface CreateRescheduleReasonModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateRescheduleReasonModal({ open, onClose }: CreateRescheduleReasonModalProps) {
  const { t } = useTranslation('rescheduleReasons');
  const { createRescheduleReason, isPending } = useCreateRescheduleReason();

  const onSubmit = async (values: CreateRescheduleReasonInput) => {
    try {
      await createRescheduleReason(values);
      onClose();
    } catch {
      // Surfaced by useApiError.
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('create.title')}>
      {open && <RescheduleReasonForm onSubmit={onSubmit} isPending={isPending} />}
    </WrapperModal>
  );
}
