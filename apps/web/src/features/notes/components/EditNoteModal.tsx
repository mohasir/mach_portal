'use client';
import { Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateNoteInput } from '@repo/schemas';
import { useUpdateNote } from '../hooks/useNotes';
import { NoteForm } from './NoteForm';
import type { Note } from '../types';

interface EditNoteModalProps {
  note: Note | null;
  open: boolean;
  onClose: () => void;
}

export function EditNoteModal({ note, open, onClose }: EditNoteModalProps) {
  const { t } = useTranslation('notes');
  const { updateNote, isPending } = useUpdateNote();

  const onSubmit = async (values: CreateNoteInput) => {
    if (!note) return;
    try {
      await updateNote(note.id, values);
      onClose();
    } catch {
      // error notificado por useApiError
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={t('edit.title')}>
      {note && (
        <NoteForm
          key={note.id}
          initialValues={{ title: note.title, content: note.content ?? undefined }}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      )}
    </Modal>
  );
}
