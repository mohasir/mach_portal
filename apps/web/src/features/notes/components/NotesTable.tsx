'use client';
import { App, Button, Space, Table, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { Can } from '@/lib/auth/Can';
import { useDeleteNote, useNotesList } from '../hooks/useNotes';
import type { Note } from '../types';

interface NotesTableProps {
  onEdit: (note: Note) => void;
}

export function NotesTable({ onEdit }: NotesTableProps) {
  const { t } = useTranslation('notes');
  const { t: tc } = useTranslation('common');
  const { modal } = App.useApp();
  const { data: notes, isLoading } = useNotesList();
  const { deleteNote } = useDeleteNote();

  const confirmDelete = (note: Note) =>
    modal.confirm({
      title: t('delete.confirmTitle'),
      content: note.title,
      okText: tc('delete'),
      okButtonProps: { danger: true },
      cancelText: tc('cancel'),
      onOk: () => deleteNote(note.id),
    });

  const columns: TableColumnsType<Note> = [
    { title: t('columns.title'), dataIndex: 'title', key: 'title' },
    {
      title: t('columns.content'),
      dataIndex: 'content',
      key: 'content',
      render: (content: string | null) => content || '—',
    },
    {
      title: '',
      key: 'actions',
      width: 140,
      align: 'right',
      render: (_, note) => (
        <Space size="small">
          <Can allowed={{ note: ['update'] }}>
            <Button type="link" size="small" onClick={() => onEdit(note)}>
              {tc('edit')}
            </Button>
          </Can>
          <Can allowed={{ note: ['delete'] }}>
            <Button type="link" size="small" danger onClick={() => confirmDelete(note)}>
              {tc('delete')}
            </Button>
          </Can>
        </Space>
      ),
    },
  ];

  return (
    <Table<Note>
      rowKey="id"
      columns={columns}
      dataSource={notes}
      loading={isLoading}
      pagination={{ pageSize: 10, hideOnSinglePage: true }}
      locale={{ emptyText: t('empty') }}
    />
  );
}
