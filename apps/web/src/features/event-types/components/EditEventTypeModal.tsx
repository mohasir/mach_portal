'use client';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateEventTypeInput } from '@repo/schemas';
import { useUpdateEventType } from '../hooks/useEventTypes';
import { EventTypeForm } from './EventTypeForm';
import type { EventType } from '../types';

interface EditEventTypeModalProps {
  eventType: EventType | null;
  open: boolean;
  onClose: () => void;
}

export function EditEventTypeModal({ eventType, open, onClose }: EditEventTypeModalProps) {
  const { t } = useTranslation('eventTypes');
  const { updateEventType, isPending } = useUpdateEventType();

  const onSubmit = async (values: CreateEventTypeInput) => {
    if (!eventType) return;
    try {
      await updateEventType(eventType.id, values);
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('edit.title')}>
      {eventType && (
        <EventTypeForm
          key={eventType.id}
          initialValues={{ name: eventType.name, color: eventType.color }}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </Modal>
  );
}
