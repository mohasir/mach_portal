import { env } from '../../env';
import { parseTenantSlug } from './host';
import { isValidSlug } from './slug';
import { resolveTenantBySlug } from './tenantResolver';

// Origins are attacker-reachable input: this must never throw and only answers
// true for an exact `<protocol>://<slug>.<base domain>` of an existing tenant.
export async function isAllowedOrigin(origin: string | undefined): Promise<boolean> {
  if (!origin) return false;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  // A browser Origin is always the canonical `url.origin`; anything else
  // (userinfo, path, trailing slash, uppercase host) is not a real Origin.
  if (url.origin !== origin || url.protocol !== `${env.APP_PROTOCOL}:`) return false;

  const slug = parseTenantSlug(url.host, env.APP_BASE_DOMAIN);
  if (!slug || !isValidSlug(slug)) return false;
  // parseTenantSlug ignores ports, so the exact host (port included) is compared here.
  if (url.host !== `${slug}.${env.APP_BASE_DOMAIN.toLowerCase()}`) return false;

  try {
    return (await resolveTenantBySlug(slug)) !== null;
  } catch (error) {
    // Fail closed; the resolver caches nothing on a failed lookup, so this is not sticky.
    console.error('[auth] origin tenant lookup failed', error);
    return false;
  }
}
