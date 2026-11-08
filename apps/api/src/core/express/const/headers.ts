export const HEADERS = {
  CACHE_CONTROL: 'Cache-Control',
  CONTENT_SECURITY_POLICY: 'Content-Security-Policy',
  CROSS_ORIGIN_OPENER_POLICY: 'Cross-Origin-Opener-Policy',
  PERMISSIONS_VERSION: 'x-permissions-version',
  REFERRER_POLICY: 'Referrer-Policy',
  STRICT_TRANSPORT_SECURITY: 'Strict-Transport-Security',
  X_CONTENT_TYPE_OPTIONS: 'X-Content-Type-Options',
  X_FRAME_OPTIONS: 'X-Frame-Options',
} as const;

export const HEADER_VALUES = {
  CACHE_NO_STORE: 'no-store',
  CSP_JSON_ONLY: "default-src 'none'; frame-ancestors 'none'",
  COOP_SAME_ORIGIN: 'same-origin',
  HSTS_ONE_YEAR: 'max-age=31536000',
  NO_REFERRER: 'no-referrer',
  NOSNIFF: 'nosniff',
  FRAME_DENY: 'DENY',
} as const;
