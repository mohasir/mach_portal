'use client';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateNoteInput } from '@repo/schemas';
import { useCreateNote } from '../hooks/useNotes';
import { NoteForm } from './NoteForm';

interface CreateNoteModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateNoteModal({ open, onClose }: CreateNoteModalProps) {
  const { t } = useTranslation('notes');
  const { createNote, isPending } = useCreateNote();

  const onSubmit = async (values: CreateNoteInput) => {
    try {
      await createNote(values);
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('create.title')}>
      {open && <NoteForm onSubmit={onSubmit} isPending={isPending} />}
    </Modal>
  );
}
