/** Coarse device/browser label from a raw User-Agent string — no parsing library is set up in the repo. */
export function parseUserAgent(userAgent?: string | null): string {
  if (!userAgent) return 'Unknown device';

  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser';

  const os = /iPhone/.test(userAgent)
    ? 'iPhone'
    : /iPad/.test(userAgent)
      ? 'iPad'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Windows/.test(userAgent)
            ? 'Windows'
            : /Linux/.test(userAgent)
              ? 'Linux'
              : 'Unknown OS';

  return `${browser} on ${os}`;
}

export function isMobileUserAgent(userAgent?: string | null): boolean {
  return !!userAgent && /iPhone|iPad|Android/.test(userAgent);
}
