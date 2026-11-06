'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DEFAULT_REDIRECT_HOME, DEFAULT_REDIRECT_LOGIN } from '@/lib/auth/navigation';
import { hasTenantChanged, subscribeSessionChanges, type SyncAction } from '../sync';
import { useActiveTenant } from './useTenant';

/**
 * Keeps this tab consistent with the session shared by all tabs: the active organization lives
 * server-side, so a switch, login or logout in another tab must not leave stale data on screen.
 */
export function useTenantSync() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data: tenant, refetch } = useActiveTenant();
  const shownId = useRef<string | null>(null);

  const resetAndGo = useCallback(
    (action: SyncAction) => {
      // Dropping the remembered id avoids re-triggering once the new organization loads.
      shownId.current = null;
      if (action !== 'login') qc.resetQueries();
      router.replace(action === 'login' ? DEFAULT_REDIRECT_LOGIN : DEFAULT_REDIRECT_HOME);
    },
    [qc, router],
  );

  useEffect(() => subscribeSessionChanges(resetAndGo), [resetAndGo]);

  const currentId = tenant?.id ?? null;
  useEffect(() => {
    if (hasTenantChanged(shownId.current, currentId)) resetAndGo('home');
    else if (currentId) shownId.current = currentId;
  }, [currentId, resetAndGo]);

  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    document.addEventListener('visibilitychange', revalidate);
    window.addEventListener('focus', revalidate);
    return () => {
      document.removeEventListener('visibilitychange', revalidate);
      window.removeEventListener('focus', revalidate);
    };
  }, [refetch]);
}
