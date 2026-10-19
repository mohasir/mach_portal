function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function parseTenantSlug(host: string | undefined, baseDomain: string): string | null {
  if (!host) return null;

  const normalizedHost = normalizeHost(host);
  const suffix = `.${normalizeHost(baseDomain)}`;
  if (!normalizedHost.endsWith(suffix)) return null;

  const label = normalizedHost.slice(0, -suffix.length);
  if (!label || label.includes('.')) return null;
  return label;
}
