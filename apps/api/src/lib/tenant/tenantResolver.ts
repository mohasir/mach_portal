import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { organization } from '../../db/schema';
import { isValidSlug } from './slug';

export type Tenant = { id: string; slug: string; name: string };

const HIT_TTL_MS = 60_000;
const MISS_TTL_MS = 10_000;
// Slugs are attacker-controlled (any subdomain), so the cache must be bounded.
const MAX_ENTRIES = 1_000;

const cache = new Map<string, { tenant: Tenant | null; expiresAt: number }>();

export function invalidateTenantCache(slug?: string): void {
  if (slug === undefined) cache.clear();
  else cache.delete(slug);
}

export async function resolveTenantBySlug(slug: string): Promise<Tenant | null> {
  if (!isValidSlug(slug)) return null;

  const cached = cache.get(slug);
  if (cached && cached.expiresAt > Date.now()) return cached.tenant;

  const [row] = await db
    .select({ id: organization.id, slug: organization.slug, name: organization.name })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  const tenant = row ?? null;

  if (cache.size >= MAX_ENTRIES) {
    // Map iterates in insertion order, so the first key is the oldest.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(slug, { tenant, expiresAt: Date.now() + (tenant ? HIT_TTL_MS : MISS_TTL_MS) });
  return tenant;
}
