'use client';
import { useMutation } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { updateUser, useSession } from '@/lib/auth/client';

export function useUpdateProfile() {
  const { message } = App.useApp();
  const { t } = useTranslation('settings');
  const { refetch } = useSession();

  const mutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await updateUser({ name });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await refetch();
      message.success(t('saveSuccess'));
    },
    onError: (error: Error) => message.error(error.message || t('profile.updateError')),
  });

  return { updateProfile: mutation.mutateAsync, isPending: mutation.isPending };
}
