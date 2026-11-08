import { TRPCClientError } from '@trpc/client';
import { getApiErrorCode } from '@/lib/error/apiErrorCode';

const INLINE_NOTICE_CODES: readonly string[] = [
  'ROLE_PRIVILEGE_ESCALATION',
  'ROLE_IS_OWNER',
  'ROLE_NOT_FOUND',
];

export type RoleSubmitOutcome =
  | { kind: 'conflict' }
  | { kind: 'nameTaken' }
  | { kind: 'notice'; code: string }
  | { kind: 'fallback' };

export function resolveSubmitError(error: unknown): RoleSubmitOutcome {
  const code = getApiErrorCode(error);
  if (code === 'ROLE_VERSION_CONFLICT') return { kind: 'conflict' };
  if (code === 'ROLE_NAME_TAKEN') return { kind: 'nameTaken' };
  if (code && INLINE_NOTICE_CODES.includes(code)) return { kind: 'notice', code };
  return { kind: 'fallback' };
}

export type RoleInUse = { kind: 'inUse'; memberCount: number };

function errorDetails(error: unknown): Record<string, unknown> | null {
  if (!(error instanceof TRPCClientError)) return null;
  const details = (error.data as { errorDetails?: unknown } | null | undefined)?.errorDetails;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : null;
}

export function resolveDeleteError(error: unknown): RoleInUse | { kind: 'fallback' } {
  if (getApiErrorCode(error) !== 'ROLE_IN_USE') return { kind: 'fallback' };
  const memberCount = errorDetails(error)?.memberCount;
  return typeof memberCount === 'number' ? { kind: 'inUse', memberCount } : { kind: 'fallback' };
}

/** Pre-check from the list row; the API still decides (a member may be added meanwhile). */
export function deleteBlock(role: { memberCount: number }): RoleInUse | null {
  return role.memberCount > 0 ? { kind: 'inUse', memberCount: role.memberCount } : null;
}

/** Why reloading the role failed: only ROLE_NOT_FOUND means it is gone. */
export function resolveReloadError(error: unknown): 'ROLE_NOT_FOUND' | 'generic' {
  return getApiErrorCode(error) === 'ROLE_NOT_FOUND' ? 'ROLE_NOT_FOUND' : 'generic';
}
