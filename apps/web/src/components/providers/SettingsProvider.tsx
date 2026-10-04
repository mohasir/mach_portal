'use client';
import { useSession } from '@/lib/auth/client';
import { useConfig, useSyncUserPreferences } from '@/features/settings';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  useConfig(!!session);
  useSyncUserPreferences(session?.user.id);
  return children;
}
