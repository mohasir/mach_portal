'use client';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@repo/ui';
import { signOut } from '@/lib/auth/client';
import { useNotesList, useCreateNote } from '../hooks/useNotes';

export function NotesPage() {
  const { t } = useTranslation('notes');
  const { data: notes, isLoading } = useNotesList();
  const { form, onSubmit, isPending } = useCreateNote();

  return (
    <div className="container mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Button variant="outline" size="sm" onClick={() => signOut()}>
          Salir
        </Button>
      </div>

      <form onSubmit={onSubmit} className="mb-8 flex gap-2">
        <Input
          {...form.register('title')}
          placeholder={t('form.titlePlaceholder')}
          className="max-w-xs"
        />
        <Input
          {...form.register('content')}
          placeholder={t('form.contentPlaceholder')}
          className="max-w-xs"
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? t('form.creating') : t('form.create')}
        </Button>
      </form>

      {form.formState.errors.title && (
        <p className="mb-4 text-sm text-destructive">
          {form.formState.errors.title.message}
        </p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">{t('loading')}</p>
      ) : (
        <div className="space-y-2">
          {notes?.map((note) => (
            <div key={note.id} className="rounded-lg border p-4">
              <h3 className="font-medium">{note.title}</h3>
              {note.content && <p className="text-muted-foreground">{note.content}</p>}
            </div>
          ))}
          {notes?.length === 0 && (
            <p className="text-muted-foreground">{t('empty')}</p>
          )}
        </div>
      )}
    </div>
  );
}
