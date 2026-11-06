import { TenancyRepository } from './tenancy.repository';

export type Tenant = { id: string; slug: string; name: string };

const HIT_TTL_MS = 60_000;
const MISS_TTL_MS = 10_000;
const MAX_ENTRIES = 1_000;

const cache = new Map<string, { tenant: Tenant | null; expiresAt: number }>();

export function invalidateTenantCache(organizationId?: string): void {
  if (organizationId === undefined) cache.clear();
  else cache.delete(organizationId);
}

export async function resolveTenantById(organizationId: string): Promise<Tenant | null> {
  if (!organizationId) return null;

  const cached = cache.get(organizationId);
  if (cached && cached.expiresAt > Date.now()) return cached.tenant;

  const tenant = (await new TenancyRepository().findById(organizationId)) ?? null;

  if (cache.size >= MAX_ENTRIES) {
    // Map iterates in insertion order, so the first key is the oldest.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(organizationId, {
    tenant,
    expiresAt: Date.now() + (tenant ? HIT_TTL_MS : MISS_TTL_MS),
  });
  return tenant;
}
