import type { RequestHandler } from 'express';
import { HEADERS, HEADER_VALUES } from './const/headers';

// The API only serves JSON, so nothing it returns should ever be framed, sniffed or run as a page.
export function securityHeaders(production: boolean): RequestHandler {
  return (_req, res, next) => {
    res.setHeader(HEADERS.X_CONTENT_TYPE_OPTIONS, HEADER_VALUES.NOSNIFF);
    res.setHeader(HEADERS.X_FRAME_OPTIONS, HEADER_VALUES.FRAME_DENY);
    res.setHeader(HEADERS.REFERRER_POLICY, HEADER_VALUES.NO_REFERRER);
    res.setHeader(HEADERS.CONTENT_SECURITY_POLICY, HEADER_VALUES.CSP_JSON_ONLY);
    res.setHeader(HEADERS.CROSS_ORIGIN_OPENER_POLICY, HEADER_VALUES.COOP_SAME_ORIGIN);
    if (production) res.setHeader(HEADERS.STRICT_TRANSPORT_SECURITY, HEADER_VALUES.HSTS_ONE_YEAR);
    next();
  };
}
