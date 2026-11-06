import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { originGuard } from '../originGuard';

function run(method: string, headers: { origin?: string; referer?: string }) {
  const req = { method, headers } as unknown as Request;
  const json = vi.fn();
  const res = { status: vi.fn(() => ({ json })) } as unknown as Response;
  const next = vi.fn();
  originGuard(req, res, next);
  return { next, res, json };
}

describe('originGuard', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('lets %s through whatever the origin', (method) => {
    expect(run(method, { origin: 'https://evil.example' }).next).toHaveBeenCalled();
  });

  it.each(['http://localhost:3000', 'http://192.168.1.10:3000'])(
    'accepts a mutation from the listed origin %s',
    (origin) => {
      expect(run('POST', { origin }).next).toHaveBeenCalled();
    },
  );

  it('accepts a mutation from a listed Referer when Origin is absent', () => {
    expect(
      run('POST', { referer: 'http://localhost:3000/admin/clients?x=1' }).next,
    ).toHaveBeenCalled();
  });

  it('accepts a request without Origin and Referer (server-side caller)', () => {
    expect(run('POST', {}).next).toHaveBeenCalled();
  });

  it.each([
    { origin: 'https://evil.example' },
    { origin: 'null' },
    { origin: 'http://localhost:3000.evil.com' },
    { referer: 'https://evil.example/page' },
    { referer: 'not a url' },
    { origin: 'https://evil.example', referer: 'http://localhost:3000/' },
  ])('rejects a mutation from %j with 403', (headers) => {
    const { next, res, json } = run('POST', headers);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ errorCode: 'FORBIDDEN_ORIGIN' });
  });
});
