'use client';
import { useTranslation } from 'react-i18next';
import type { CreateEventTypeInput } from '@repo/schemas';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { useCreateEventType } from '../hooks/useEventTypes';
import { EventTypeForm } from './EventTypeForm';

interface CreateEventTypeModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateEventTypeModal({ open, onClose }: CreateEventTypeModalProps) {
  const { t } = useTranslation('eventTypes');
  const { createEventType, isPending } = useCreateEventType();

  const onSubmit = async (values: CreateEventTypeInput) => {
    try {
      await createEventType(values);
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <WrapperModal open={open} onCancel={onClose} title={t('create.title')}>
      {open && <EventTypeForm onSubmit={onSubmit} isPending={isPending} />}
    </WrapperModal>
  );
}
