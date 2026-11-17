import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  CATALOG_KINDS,
  DEFAULT_CATALOG_KIND,
  isCatalogKind,
  type CatalogKind,
} from '@repo/schemas';
import type { Executor } from '../../db';
import { organization, tenantProfile } from '../../db/schema';
import { AppError, ErrorCodes } from '../errors';
import { normalizeSlug } from './slug';
import { tenantEq } from './tenantEq';

export type SetCatalogKindInput = { tenantSlug: string; kind: string };

// Under the app role the caller must be inside the tenant transaction (the table has RLS).
export async function getCatalogKind(executor: Executor, tenantId: string): Promise<CatalogKind> {
  const [row] = await executor
    .select({ catalogKind: tenantProfile.catalogKind })
    .from(tenantProfile)
    .where(tenantEq(tenantProfile, tenantId))
    .limit(1);
  return row && isCatalogKind(row.catalogKind) ? row.catalogKind : DEFAULT_CATALOG_KIND;
}

// A platform-level action: only the platform role can write tenant_profile.
export async function setCatalogKind(
  database: Executor,
  input: SetCatalogKindInput,
): Promise<void> {
  if (!isCatalogKind(input.kind)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      cause: new AppError(
        ErrorCodes.tenant.UNKNOWN_CATALOG_KIND,
        `Unknown catalog kind "${input.kind}". Known: ${CATALOG_KINDS.join(', ')}`,
      ),
    });
  }
  const kind = input.kind;
  const [org] = await database
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, normalizeSlug(input.tenantSlug)))
    .limit(1);
  if (!org) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      cause: new AppError(
        ErrorCodes.tenant.NOT_FOUND,
        `Tenant "${input.tenantSlug}" does not exist`,
      ),
    });
  }
  await database
    .insert(tenantProfile)
    .values({ tenantId: org.id, catalogKind: kind })
    .onConflictDoUpdate({
      target: tenantProfile.tenantId,
      set: { catalogKind: kind, updatedAt: new Date() },
    });
}
