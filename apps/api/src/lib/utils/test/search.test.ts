import { describe, expect, it } from 'vitest';
import { listQuerySchema } from '@repo/schemas';
import { containsPattern } from '../search';

describe('containsPattern', () => {
  it('escapes LIKE wildcards and the escape character', () => {
    expect(containsPattern('50%_off\\x')).toBe('%50\\%\\_off\\\\x%');
  });

  it('wraps plain text unchanged', () => {
    expect(containsPattern('ana')).toBe('%ana%');
  });
});

describe('listQuerySchema.search', () => {
  it('rejects a NUL byte', () => {
    expect(listQuerySchema.safeParse({ search: 'a\u0000b' }).success).toBe(false);
  });

  it('accepts and trims ordinary text', () => {
    expect(listQuerySchema.parse({ search: '  ana  ' }).search).toBe('ana');
  });
});
