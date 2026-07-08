'use client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { CreateNoteModal } from './CreateNoteModal';
import { EditNoteModal } from './EditNoteModal';
import { NotesTable } from './NotesTable';
import type { Note } from '../types';

export function NotesPage() {
  const { t } = useTranslation('notes');
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

  return (
    <div>
      <PageHeader title={t('title')} actionLabel={t('index.add')} onAction={() => setCreateOpen(true)} />
      <NotesTable onEdit={setEditing} />
      <CreateNoteModal open={isCreateOpen} onClose={() => setCreateOpen(false)} />
      <EditNoteModal note={editing} open={!!editing} onClose={() => setEditing(null)} />
    </div>
  );
}
