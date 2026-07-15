'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { revokeSession } from '@/lib/auth/client';

export function useRevokeSession() {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { t } = useTranslation('settings');

  const mutation = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await revokeSession({ token });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      message.success(t('security.sessions.revokeSuccess'));
    },
    onError: (error: Error) => message.error(error.message || t('security.sessions.revokeError')),
  });

  return { revokeSession: mutation.mutateAsync, isPending: mutation.isPending };
}
