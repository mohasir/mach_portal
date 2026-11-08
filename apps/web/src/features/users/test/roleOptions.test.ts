import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { AppRouter } from 'api';

const env = vi.hoisted(() => ({ captured: [] as unknown[] }));

const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient<AppRouter>({ links: [] }),
  queryClient: new QueryClient(),
});

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: (options: unknown) => {
    env.captured.push(options);
    return { data: undefined, isLoading: true };
  },
}));

vi.mock('@/lib/trpc/client', () => ({ useTRPC: () => trpc }));
vi.mock('@/lib/error/useApiError', () => ({ useApiError: () => () => undefined }));

import { useAssignableRoles } from '../hooks/useUsers';
import { toRoleOptions } from '../helpers';

const label = (role: { name: string; isOwner: boolean }) =>
  role.isOwner ? 'Owner' : role.name.toUpperCase();

describe('useAssignableRoles', () => {
  it('asks for the roles the caller may assign, not the role list behind role.read', () => {
    env.captured = [];
    useAssignableRoles();
    const options = env.captured[0] as { queryKey: unknown };
    expect(options.queryKey).toEqual(trpc.roles.assignable.queryKey());
    expect(options.queryKey).not.toEqual(trpc.roles.list.queryKey());
  });
});

describe('toRoleOptions', () => {
  const roles = [
    { id: 'r-owner', name: 'Superadmin', isOwner: true },
    { id: 'r-sales', name: 'Sales', isOwner: false },
  ];

  it("offers exactly the organization's assignable roles, valued by id", () => {
    expect(toRoleOptions(roles, label)).toEqual([
      { value: 'r-owner', label: 'Owner' },
      { value: 'r-sales', label: 'SALES' },
    ]);
  });

  it('offers nothing while the roles are loading', () => {
    expect(toRoleOptions(undefined, label)).toEqual([]);
  });

  it("shows the member's current role by name while the roles are loading", () => {
    const current = { id: 'r-admin', name: 'Admin', isOwner: false };
    expect(toRoleOptions(undefined, label, current)).toEqual([
      { value: 'r-admin', label: 'ADMIN' },
    ]);
  });

  it("keeps the member's current role visible but not selectable when it is not assignable", () => {
    const current = { id: 'r-admin', name: 'Admin', isOwner: false };
    expect(toRoleOptions(roles, label, current)).toEqual([
      { value: 'r-owner', label: 'Owner' },
      { value: 'r-sales', label: 'SALES' },
      { value: 'r-admin', label: 'ADMIN', disabled: true },
    ]);
    expect(toRoleOptions(roles, label, roles[1])).toHaveLength(2);
  });
});
