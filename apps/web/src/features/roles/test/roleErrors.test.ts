import { TRPCClientError } from '@trpc/client';
import { describe, expect, it } from 'vitest';
import {
  deleteBlock,
  resolveDeleteError,
  resolveReloadError,
  resolveSubmitError,
} from '../lib/roleErrors';

const trpcError = (data: Record<string, unknown>) =>
  Object.assign(new TRPCClientError('boom'), { data });

describe('resolveSubmitError', () => {
  it('a version conflict keeps the draft and offers a reload', () => {
    expect(
      resolveSubmitError(trpcError({ code: 'CONFLICT', errorCode: 'ROLE_VERSION_CONFLICT' })),
    ).toEqual({ kind: 'conflict' });
  });

  it('a taken name goes to the name field', () => {
    expect(
      resolveSubmitError(trpcError({ code: 'CONFLICT', errorCode: 'ROLE_NAME_TAKEN' })),
    ).toEqual({ kind: 'nameTaken' });
  });

  it.each(['ROLE_PRIVILEGE_ESCALATION', 'ROLE_IS_OWNER', 'ROLE_NOT_FOUND'])(
    '%s is shown as an inline notice',
    (errorCode) => {
      expect(resolveSubmitError(trpcError({ code: 'FORBIDDEN', errorCode }))).toEqual({
        kind: 'notice',
        code: errorCode,
      });
    },
  );

  it('anything else falls back to the generic API error handling', () => {
    expect(resolveSubmitError(trpcError({ code: 'BAD_REQUEST', errorCode: null }))).toEqual({
      kind: 'fallback',
    });
    expect(resolveSubmitError(new Error('network'))).toEqual({ kind: 'fallback' });
  });
});

describe('resolveDeleteError', () => {
  it('a role in use reports how many members it has', () => {
    expect(
      resolveDeleteError(
        trpcError({
          code: 'CONFLICT',
          errorCode: 'ROLE_IN_USE',
          errorDetails: { memberCount: 4 },
        }),
      ),
    ).toEqual({ kind: 'inUse', memberCount: 4 });
  });

  it('falls back when the member count is missing or malformed', () => {
    expect(resolveDeleteError(trpcError({ code: 'CONFLICT', errorCode: 'ROLE_IN_USE' }))).toEqual({
      kind: 'fallback',
    });
    expect(
      resolveDeleteError(
        trpcError({ errorCode: 'ROLE_IN_USE', errorDetails: { memberCount: 'x' } }),
      ),
    ).toEqual({ kind: 'fallback' });
  });

  it('other errors fall back', () => {
    expect(resolveDeleteError(trpcError({ errorCode: 'ROLE_IS_OWNER' }))).toEqual({
      kind: 'fallback',
    });
  });
});

describe('deleteBlock', () => {
  it('blocks a role with members before calling the API', () => {
    expect(deleteBlock({ memberCount: 2 })).toEqual({
      kind: 'inUse',
      memberCount: 2,
    });
  });

  it('allows a role without members', () => {
    expect(deleteBlock({ memberCount: 0 })).toBeNull();
  });
});

describe('resolveReloadError', () => {
  it('says the role is gone only for ROLE_NOT_FOUND', () => {
    expect(resolveReloadError(trpcError({ code: 'NOT_FOUND', errorCode: 'ROLE_NOT_FOUND' }))).toBe(
      'ROLE_NOT_FOUND',
    );
  });

  it('anything else is a generic error', () => {
    expect(resolveReloadError(trpcError({ code: 'INTERNAL_SERVER_ERROR', errorCode: null }))).toBe(
      'generic',
    );
    expect(resolveReloadError(trpcError({ code: 'FORBIDDEN', errorCode: 'ROLE_IS_OWNER' }))).toBe(
      'generic',
    );
    expect(resolveReloadError(new Error('network'))).toBe('generic');
    expect(resolveReloadError(null)).toBe('generic');
  });
});
