import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { env } from '../../env';

// Digesting both sides gives equal-length buffers, so the comparison never
// leaks the expected key length.
function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

// The tenant host is only trusted when the request comes from our own proxy;
// otherwise any client could spoof `x-tenant-host`.
export function readTenantHost(headers: IncomingHttpHeaders): string | undefined {
  const key = headers['x-internal-key'];
  const host = headers['x-tenant-host'];
  // Repeated headers arrive as arrays: ambiguous, so never trusted.
  if (typeof key !== 'string' || typeof host !== 'string') return undefined;
  return safeEqual(key, env.INTERNAL_PROXY_KEY) ? host : undefined;
}
