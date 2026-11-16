'use client';
import { useTranslation } from 'react-i18next';
import type { CreateUnitInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useUpdateUnit } from '../hooks/useUnitsOfMeasure';
import type { UnitOfMeasure } from '../types';
import { UnitForm } from './UnitForm';

interface EditUnitModalProps {
  unit: UnitOfMeasure | null;
  open: boolean;
  onClose: () => void;
}

export function EditUnitModal({ unit, open, onClose }: EditUnitModalProps) {
  const { t } = useTranslation('unitsOfMeasure');
  const { updateUnit, isPending } = useUpdateUnit();

  const onSubmit = async (values: CreateUnitInput) => {
    if (!unit) return;
    try {
      await updateUnit(unit.id, values);
      onClose();
    } catch {
      // Surfaced by useApiError.
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('edit.title')}>
      {unit && <UnitForm key={unit.id} unit={unit} onSubmit={onSubmit} isPending={isPending} />}
    </WrapperModal>
  );
}
