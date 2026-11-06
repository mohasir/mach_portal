import { describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as string[]);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (url: string) => calls.push(`replace:${url}`) }),
}));
vi.mock('@/lib/auth/client', () => ({
  signOut: async () => {
    calls.push('signOut');
  },
}));
vi.mock('../sync', () => ({
  broadcastSessionChange: (kind: string) => calls.push(`broadcast:${kind}`),
}));

import { useSignOut } from '../hooks/useSignOut';

describe('useSignOut', () => {
  it('signs out, tells the other tabs, then goes to the login screen', async () => {
    await useSignOut()();
    expect(calls).toEqual(['signOut', 'broadcast:logout', 'replace:/login']);
  });
});
