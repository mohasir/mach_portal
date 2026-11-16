'use client';
import { App, type FormInstance } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { TRPCClientError } from '@trpc/client';
import { useCatalogVocabulary } from '@/features/tenant/hooks/useCatalogVocabulary';
import type { CatalogVocabulary } from '@/features/tenant/vocabulary';

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
 * Traduce un `errorCode`/`code` de dominio a un toast, para transportes que no son
 * tRPC (ej. la ruta Express de upload de comprobantes) y por eso no producen un
 * `TRPCClientError` que `useApiError` pueda inspeccionar directamente.
 */
export function reportApiErrorCode(
  errorCode: string | null | undefined,
  t: TFunction<'api'>,
  message: MessageInstance,
  vocabulary?: CatalogVocabulary,
) {
  message.error(
    t(errorCode ? `errors.${errorCode}` : 'errors.generic', {
      defaultValue: t('errors.generic'),
      ...vocabulary,
    }),
  );
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
  const vocabulary = useCatalogVocabulary();

  return (error: unknown) => {
    if (error instanceof TRPCClientError) {
      const data = error.data as ApiErrorData | null | undefined;
      if (form && data?.fieldErrors?.length) {
        form.setFields(
          data.fieldErrors.map(({ path, message: msg }) => ({ name: path, errors: [t(msg, msg)] })),
        );
        return;
      }
      reportApiErrorCode(data?.errorCode ?? data?.code, t, message, vocabulary);
      return;
    }
    message.error(t('errors.generic'));
  };
}
