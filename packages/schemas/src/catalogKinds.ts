import { z } from 'zod';

// Adding a kind is one entry here plus its words in the web `vocabulary` namespace; the column
// is plain text, so it needs no migration.
export const CATALOG_KINDS = ['products', 'services'] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];

export const DEFAULT_CATALOG_KIND: CatalogKind = 'products';

export const catalogKindSchema = z.enum(CATALOG_KINDS);

export const isCatalogKind = (value: unknown): value is CatalogKind =>
  (CATALOG_KINDS as readonly unknown[]).includes(value);

export const tenantProfileSchema = z.object({ catalogKind: catalogKindSchema });
export type TenantProfile = z.infer<typeof tenantProfileSchema>;
