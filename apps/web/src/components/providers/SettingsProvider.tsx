'use client';
import { useSession } from '@/lib/auth/client';
import { shouldLoadTenantSettings, useConfig, useSyncUserPreferences } from '@/features/settings';
import { useActiveTenantStatus } from '@/features/tenant';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const hasSession = !!session;
  const { resolved, hasTenant } = useActiveTenantStatus(hasSession);
  const enabled = shouldLoadTenantSettings({
    hasSession,
    tenantResolved: resolved,
    hasActiveTenant: hasTenant,
  });
  useConfig(enabled);
  useSyncUserPreferences(session?.user.id, enabled);
  return children;
}
