import { TRPCClientError } from '@trpc/client';
import { describe, expect, it } from 'vitest';
import { getApiErrorCode, isTenantAccessError } from '../apiErrorCode';

const trpcError = (data: Record<string, unknown>) =>
  Object.assign(new TRPCClientError('boom'), { data });

describe('getApiErrorCode', () => {
  it('prefers the domain errorCode over the tRPC code', () => {
    expect(getApiErrorCode(trpcError({ errorCode: 'TENANT_NOT_SELECTED', code: 'FORBIDDEN' }))).toBe(
      'TENANT_NOT_SELECTED',
    );
  });

  it('falls back to the tRPC code when there is no domain code', () => {
    expect(getApiErrorCode(trpcError({ errorCode: null, code: 'NOT_FOUND' }))).toBe('NOT_FOUND');
  });

  it('returns undefined for non-tRPC errors', () => {
    expect(getApiErrorCode(new Error('x'))).toBeUndefined();
    expect(getApiErrorCode(null)).toBeUndefined();
  });
});

describe('isTenantAccessError', () => {
  it.each(['TENANT_NOT_SELECTED', 'TENANT_NOT_FOUND'])('detects %s', (errorCode) => {
    expect(isTenantAccessError(trpcError({ errorCode, code: 'FORBIDDEN' }))).toBe(true);
  });

  it('ignores other errors, including a plain NOT_FOUND', () => {
    expect(isTenantAccessError(trpcError({ errorCode: 'QUOTE_NOT_FOUND', code: 'NOT_FOUND' }))).toBe(
      false,
    );
    expect(isTenantAccessError(trpcError({ errorCode: null, code: 'NOT_FOUND' }))).toBe(false);
    expect(isTenantAccessError(new Error('x'))).toBe(false);
  });
});
