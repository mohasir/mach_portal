import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { securityHeaders } from '../securityHeaders';

function headersFor(production: boolean) {
  const headers = new Map<string, string>();
  const res = { setHeader: (k: string, v: string) => headers.set(k.toLowerCase(), v) };
  const next = vi.fn();
  securityHeaders(production)({} as Request, res as unknown as Response, next);
  expect(next).toHaveBeenCalled();
  return headers;
}

describe('securityHeaders', () => {
  it('sets the JSON-API hardening headers', () => {
    const headers = headersFor(false);
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-frame-options')).toBe('DENY');
    expect(headers.get('referrer-policy')).toBe('no-referrer');
    expect(headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(headers.has('strict-transport-security')).toBe(false);
  });

  it('adds HSTS only in production', () => {
    expect(headersFor(true).get('strict-transport-security')).toMatch(/^max-age=\d+/);
  });
});
