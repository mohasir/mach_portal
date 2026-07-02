import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { createNoteSchema, type CreateNoteInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import i18n from '@/lib/i18n/config';

function translateZodMessage(message: string): string {
  const dotIndex = message.indexOf('.');
  if (dotIndex === -1) return message;
  const ns = message.slice(0, dotIndex);
  const key = message.slice(dotIndex + 1);
  return i18n.t(key, { ns, defaultValue: message });
}

export function useNotesList() {
  const trpc = useTRPC();
  return useQuery(trpc.notes.list.queryOptions());
}

export function useCreateNote() {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const form = useForm<CreateNoteInput>({
    defaultValues: { title: '', content: '' },
  });

  const mutation = useMutation(
    trpc.notes.create.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries(trpc.notes.list.queryFilter());
        form.reset();
      },
    }),
  );

  const onSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    const result = createNoteSchema.safeParse(form.getValues());

    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof CreateNoteInput;
        if (key) {
          form.setError(key, { message: translateZodMessage(issue.message) });
        }
      }
      return;
    }

    form.clearErrors();
    await mutation.mutateAsync(result.data);
  };

  return { form, onSubmit, isPending: mutation.isPending };
}
