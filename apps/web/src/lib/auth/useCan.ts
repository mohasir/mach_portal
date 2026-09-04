'use client';
import { ACTIONS, DEFAULT_ROLE, hasPermission, RESOURCES, type PermissionCheck } from '@repo/guards';
import { useSession } from '@/lib/auth/client';

export function useCan() {
  const { data } = useSession();
  const role = (data?.user as { role?: string | null } | undefined)?.role ?? DEFAULT_ROLE;
  return (permissions: PermissionCheck) => hasPermission(role, permissions);
}

// Mirrors the same gate enforced server-side in quotes.router.ts's `assign` mutation.
export function useCanReassignQuote() {
  const { data } = useSession();
  const role = (data?.user as { role?: string | null } | undefined)?.role ?? DEFAULT_ROLE;
  return hasPermission(role, { [RESOURCES.QUOTE]: [ACTIONS.MANAGE_ASSIGNMENT] });
}

// Mirrors the same gate enforced server-side in quotes.router.ts's `regeneratePdf` mutation.
export function useCanRegeneratePdf() {
  const { data } = useSession();
  const role = (data?.user as { role?: string | null } | undefined)?.role ?? DEFAULT_ROLE;
  return hasPermission(role, { [RESOURCES.QUOTE]: [ACTIONS.REGENERATE_PDF] });
}
