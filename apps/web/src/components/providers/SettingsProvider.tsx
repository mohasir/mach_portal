'use client';
import { useSession } from '@/lib/auth/client';
import { useConfig } from '@/features/settings';

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  useConfig(!!session);
  return children;
}
