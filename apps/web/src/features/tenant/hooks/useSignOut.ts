'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth/client';
import { DEFAULT_REDIRECT_LOGIN } from '@/lib/auth/navigation';
import { broadcastSessionChange } from '../sync';

// The query cache is cleared by the login screen, not here: clearing it while the authenticated
// page is still mounted would refetch every active query without a session.
export function useSignOut() {
  const router = useRouter();
  return async () => {
    await signOut();
    broadcastSessionChange('logout');
    router.replace(DEFAULT_REDIRECT_LOGIN);
  };
}
