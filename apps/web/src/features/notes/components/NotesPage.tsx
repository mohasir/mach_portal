'use client';
import { Form, Input, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateNoteInput } from '@repo/schemas';
import { signOut } from '@/lib/auth/client';
import { useNotesList, useCreateNote } from '../hooks/useNotes';

export function NotesPage() {
  const { t } = useTranslation('notes');
  const [form] = Form.useForm<CreateNoteInput>();
  const { data: notes, isLoading } = useNotesList();
  const { createNote, isPending } = useCreateNote();

  const onFinish = async (values: CreateNoteInput) => {
    await createNote(values);
    form.resetFields();
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading m-0 text-2xl text-brown">{t('title')}</h1>
        <Button size="small" onClick={() => signOut()}>Salir</Button>
      </div>

      <Form form={form} onFinish={onFinish} layout="inline" className="mb-8">
        <Form.Item name="title" rules={[{ required: true, message: t('validation.titleRequired') }]}>
          <Input placeholder={t('form.titlePlaceholder')} className="w-[200px]" />
        </Form.Item>
        <Form.Item name="content">
          <Input placeholder={t('form.contentPlaceholder')} className="w-[200px]" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={isPending}>
            {isPending ? t('form.creating') : t('form.create')}
          </Button>
        </Form.Item>
      </Form>

      {isLoading ? (
        <p className="text-muted">{t('loading')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {notes?.map((note) => (
            <div key={note.id} className="rounded-[10px] border-[0.5px] border-line bg-surface p-4">
              <h3 className="m-0 mb-1 font-medium">{note.title}</h3>
              {note.content && <p className="m-0 text-muted">{note.content}</p>}
            </div>
          ))}
          {notes?.length === 0 && <p className="text-muted">{t('empty')}</p>}
        </div>
      )}
    </div>
  );
}
