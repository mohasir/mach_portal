'use client';
import { useTranslation } from 'react-i18next';
import type { CreateUnitInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useCreateUnit } from '../hooks/useUnitsOfMeasure';
import { UnitForm } from './UnitForm';

interface CreateUnitModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateUnitModal({ open, onClose }: CreateUnitModalProps) {
  const { t } = useTranslation('unitsOfMeasure');
  const { createUnit, isPending } = useCreateUnit();

  const onSubmit = async (values: CreateUnitInput) => {
    try {
      await createUnit(values);
      onClose();
    } catch {
      // Surfaced by useApiError.
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('create.title')}>
      {open && <UnitForm onSubmit={onSubmit} isPending={isPending} />}
    </WrapperModal>
  );
}
