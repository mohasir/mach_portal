'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, type FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import type { CreateRoleInput, UpdateRoleInput } from '@repo/schemas';
import { useTRPC } from '@/lib/trpc/client';
import { useApiError } from '@/lib/error/useApiError';
import { resolveDeleteError, resolveSubmitError } from '../lib/roleErrors';

export function useRolesList() {
  const trpc = useTRPC();
  return useQuery(trpc.roles.list.queryOptions());
}

// Always read fresh when the editor opens: the version it carries guards the save.
export function useRole(id: string | null) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.roles.get.queryOptions({ id: id ?? '' }),
    enabled: !!id,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

// Conflict, taken name and role notices are shown by the form itself; only the rest is reported.
function useRoleSubmitError(form?: FormInstance) {
  const apiError = useApiError(form);
  return (error: unknown) => {
    if (resolveSubmitError(error).kind === 'fallback') apiError(error);
  };
}

export function useCreateRole(form?: FormInstance) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useRoleSubmitError(form);

  const mutation = useMutation(
    trpc.roles.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.roles.pathFilter()),
      onError,
    }),
  );

  return {
    createRole: (data: CreateRoleInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useUpdateRole(form?: FormInstance) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useRoleSubmitError(form);

  const mutation = useMutation(
    trpc.roles.update.mutationOptions({
      onSuccess: () =>
        Promise.all([
          qc.invalidateQueries(trpc.roles.pathFilter()),
          // The edited role may be the actor's own.
          qc.invalidateQueries(trpc.tenant.permissions.queryFilter()),
        ]),
      onError,
    }),
  );

  return {
    updateRole: (data: UpdateRoleInput) => mutation.mutateAsync(data),
    isPending: mutation.isPending,
  };
}

export function useDuplicateRole() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const onError = useApiError();

  const mutation = useMutation(
    trpc.roles.duplicate.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.roles.pathFilter()),
      onError,
    }),
  );

  return {
    duplicateRole: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}

export function useDeleteRole() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const apiError = useApiError();
  const { modal } = App.useApp();
  const { t } = useTranslation('roles');
  const { t: tc } = useTranslation('common');

  const mutation = useMutation(
    trpc.roles.delete.mutationOptions({
      onSuccess: () => qc.invalidateQueries(trpc.roles.pathFilter()),
      onError: (error) => {
        const outcome = resolveDeleteError(error);
        if (outcome.kind === 'fallback') return apiError(error);
        // Members may have been assigned after the list loaded; refresh the counts shown.
        void qc.invalidateQueries(trpc.roles.list.queryFilter());
        modal.warning({
          title: t('delete.inUseTitle'),
          content: t('delete.inUseContent', { count: outcome.memberCount }),
          okText: tc('accept'),
        });
      },
    }),
  );

  return {
    deleteRole: (id: string) => mutation.mutateAsync({ id }),
    isPending: mutation.isPending,
  };
}
