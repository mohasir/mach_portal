import type { RequestHandler } from 'express';
import { isAllowedOrigin } from './cors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// CORS only stops a browser from reading the response: a cross-site form post or a same-site
// sibling host could still trigger a state change with the session cookie. Requests that carry no
// Origin and no Referer (server-side calls from the web, scripts) are not browser-forgeable and pass.
export const originGuard: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const source = origin ?? (referer === undefined ? undefined : originOf(referer));
  if (source === undefined || (source !== null && isAllowedOrigin(source))) return next();
  res.status(403).json({ errorCode: 'FORBIDDEN_ORIGIN' });
};
