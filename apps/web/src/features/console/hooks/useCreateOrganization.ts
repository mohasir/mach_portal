import type { FormInstance } from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { CreateOrganizationInput } from '@repo/schemas';
import { getApiErrorCode } from '@/lib/error/apiErrorCode';
import { useApiError } from '@/lib/error/useApiError';
import { useTRPC } from '@/lib/trpc/client';
import { slugErrorCodes } from '../helpers';
import { useInvalidateConsole } from './useInvalidateConsole';

export function useCreateOrganization(form?: FormInstance) {
  const trpc = useTRPC();
  const { t } = useTranslation('api');
  const invalidate = useInvalidateConsole();
  const reportError = useApiError(form);

  const mutation = useMutation(
    trpc.console.organizations.create.mutationOptions({
      onSuccess: invalidate,
      onError: (error) => {
        const code = getApiErrorCode(error);
        if (form && code && slugErrorCodes.includes(code)) {
          form.setFields([{ name: 'slug', errors: [t(`errors.${code}`)] }]);
          return;
        }
        reportError(error);
      },
    }),
  );

  return {
    createOrganization: (data: CreateOrganizationInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
    // Drops the cached result, which holds the one-time setup link.
    reset: mutation.reset,
  };
}
