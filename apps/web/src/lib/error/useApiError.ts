'use client';
import { App, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import { TRPCClientError } from '@trpc/client';

interface ApiFieldError {
  path: (string | number)[];
  message: string;
}

interface ApiErrorData {
  code?: string;
  errorCode?: string;
  fieldErrors?: ApiFieldError[] | null;
}

/**
 * Manejo centralizado de errores de tRPC.
 * Con `form`: si el error trae `fieldErrors` (falló el `.input(schema)` de Zod en el backend),
 * los pinta sobre el campo correspondiente con `form.setFields` en vez del toast genérico.
 * Sin `form`, o si no hay `fieldErrors`: traduce por `errorCode` de dominio (ver errorFormatter
 * del backend), cae al `code` estándar de tRPC y a un genérico, y muestra un toast.
 */
export function useApiError(form?: FormInstance) {
  const { message } = App.useApp();
  const { t } = useTranslation('api');

  return (error: unknown) => {
    if (error instanceof TRPCClientError) {
      const data = error.data as ApiErrorData | null | undefined;
      if (form && data?.fieldErrors?.length) {
        form.setFields(
          data.fieldErrors.map(({ path, message: msg }) => ({ name: path, errors: [t(msg, msg)] })),
        );
        return;
      }
      const key = data?.errorCode
        ? `errors.${data.errorCode}`
        : `errors.${data?.code ?? 'generic'}`;
      message.error(t(key, t('errors.generic')));
      return;
    }
    message.error(t('errors.generic'));
  };
}
