'use client';
import { useTranslation } from 'react-i18next';
import type { CreateChargeTypeInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useUpdateChargeType } from '../hooks/useChargeTypes';
import type { ChargeType } from '../types';
import { ChargeTypeForm } from './ChargeTypeForm';

interface EditChargeTypeModalProps {
  type: ChargeType | null;
  open: boolean;
  onClose: () => void;
}

export function EditChargeTypeModal({ type, open, onClose }: EditChargeTypeModalProps) {
  const { t } = useTranslation('chargeTypes');
  const { updateChargeType, isPending } = useUpdateChargeType();

  const onSubmit = async (values: CreateChargeTypeInput) => {
    if (!type) return;
    try {
      await updateChargeType(type.id, values);
      onClose();
    } catch {
      // Surfaced by useApiError.
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('edit.title')}>
      {type && (
        <ChargeTypeForm key={type.id} type={type} onSubmit={onSubmit} isPending={isPending} />
      )}
    </WrapperModal>
  );
}
