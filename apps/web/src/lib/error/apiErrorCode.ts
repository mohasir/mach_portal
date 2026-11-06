import { TRPCClientError } from '@trpc/client';

const TENANT_ACCESS_CODES: readonly string[] = ['TENANT_NOT_SELECTED', 'TENANT_NOT_FOUND'];

/** Domain `errorCode` (falling back to the tRPC `code`) carried by a tRPC client error. */
export function getApiErrorCode(error: unknown): string | undefined {
  if (!(error instanceof TRPCClientError)) return undefined;
  const data = error.data as { errorCode?: string | null; code?: string } | null | undefined;
  return data?.errorCode ?? data?.code ?? undefined;
}

export function isTenantAccessError(error: unknown): boolean {
  const code = getApiErrorCode(error);
  return !!code && TENANT_ACCESS_CODES.includes(code);
}
