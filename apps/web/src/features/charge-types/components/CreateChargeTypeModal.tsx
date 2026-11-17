'use client';
import { useTranslation } from 'react-i18next';
import type { CreateChargeTypeInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useCreateChargeType } from '../hooks/useChargeTypes';
import { ChargeTypeForm } from './ChargeTypeForm';

interface CreateChargeTypeModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateChargeTypeModal({ open, onClose }: CreateChargeTypeModalProps) {
  const { t } = useTranslation('chargeTypes');
  const { createChargeType, isPending } = useCreateChargeType();

  const onSubmit = async (values: CreateChargeTypeInput) => {
    try {
      await createChargeType(values);
      onClose();
    } catch {
      // Surfaced by useApiError.
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('create.title')}>
      {open && <ChargeTypeForm onSubmit={onSubmit} isPending={isPending} />}
    </WrapperModal>
  );
}
