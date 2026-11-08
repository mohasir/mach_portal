'use client';
import { ACTIONS, can, RESOURCES, type PermissionCheck } from '@repo/guards';
import { usePermissions } from '@/features/tenant';

// Denies everything until the permissions load: the tenant gate holds the screen until then.
export function useCan() {
  const { access } = usePermissions();
  return (permissions: PermissionCheck) => can(access, permissions);
}

/** The caller's role in the active organization, once the permissions load. */
export function useCurrentRole() {
  return usePermissions().role;
}

// Mirrors the same gate enforced server-side in quotes.router.ts's `assign` mutation.
export function useCanReassignQuote() {
  return useCan()({ [RESOURCES.QUOTE]: [ACTIONS.MANAGE_ASSIGNMENT] });
}

// Mirrors the same gate enforced server-side in quotes.router.ts's `regeneratePdf` mutation.
export function useCanRegeneratePdf() {
  return useCan()({ [RESOURCES.QUOTE]: [ACTIONS.REGENERATE_PDF] });
}
