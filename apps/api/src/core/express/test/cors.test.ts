import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { env } from '../../../env';
import { corsMiddleware } from '../cors';

function run(origin: string | undefined, method = 'GET') {
  const headers = new Map<string, string>();
  const req = { method, headers: origin ? { origin } : {} } as unknown as Request;
  const res = {
    setHeader: (k: string, v: string) => headers.set(k.toLowerCase(), v),
    getHeader: (k: string) => headers.get(k.toLowerCase()),
    end: vi.fn(),
    statusCode: 200,
  } as unknown as Response;
  const next = vi.fn();
  corsMiddleware(req, res, next);
  return { headers, next };
}

describe('corsMiddleware', () => {
  it.each(env.WEB_ORIGIN)('allows the listed origin %s with credentials', (origin) => {
    const { headers, next } = run(origin);
    expect(headers.get('access-control-allow-origin')).toBe(origin);
    expect(headers.get('access-control-allow-credentials')).toBe('true');
    expect(next).toHaveBeenCalled();
  });

  it.each(['http://evil.com', 'http://localhost:3001', 'http://localhost:3000.evil.com', 'null'])(
    'does not grant the unlisted origin %s',
    (origin) => {
      const { headers } = run(origin);
      expect(headers.get('access-control-allow-origin')).toBeUndefined();
    },
  );

  it('does not answer a preflight from an unlisted origin with allow headers', () => {
    const { headers } = run('http://evil.com', 'OPTIONS');
    expect(headers.get('access-control-allow-origin')).toBeUndefined();
  });

  it('lets requests without an Origin header through untouched', () => {
    const { headers, next } = run(undefined);
    expect(headers.get('access-control-allow-origin')).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
