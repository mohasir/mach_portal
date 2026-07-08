'use client';
import { App } from 'antd';
import { useTranslation } from 'react-i18next';
import { TRPCClientError } from '@trpc/client';

/**
 * Manejo centralizado de errores de tRPC.
 * Traduce por `errorCode` de dominio (ver errorFormatter del backend) y cae al
 * `code` estándar de tRPC y a un genérico. Devuelve un `onError` reutilizable
 * para pasar a `mutationOptions`/`queryOptions`.
 */
export function useApiError() {
  const { message } = App.useApp();
  const { t } = useTranslation('api');

  return (error: unknown) => {
    let key = 'errors.generic';
    if (error instanceof TRPCClientError) {
      const data = error.data as { code?: string; errorCode?: string } | null | undefined;
      if (data?.errorCode) key = `errors.${data.errorCode}`;
      else if (data?.code) key = `errors.${data.code}`;
    }
    message.error(t(key, t('errors.generic')));
  };
}
