'use client';
import { useMutation } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { changePassword } from '@/lib/auth/client';

interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export function useChangePassword() {
  const { message } = App.useApp();
  const { t } = useTranslation('settings');

  const mutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: ChangePasswordInput) => {
      const { error } = await changePassword({ currentPassword, newPassword });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => message.success(t('profile.changePassword.success')),
    onError: (error: Error) => message.error(error.message || t('profile.changePassword.error')),
  });

  return { changePassword: mutation.mutateAsync, isPending: mutation.isPending };
}
