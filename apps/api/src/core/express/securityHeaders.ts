import type { RequestHandler } from 'express';

// The API only serves JSON, so nothing it returns should ever be framed, sniffed or run as a page.
export function securityHeaders(production: boolean): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (production) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  };
}
