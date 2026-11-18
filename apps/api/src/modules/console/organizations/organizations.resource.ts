import type { ConsoleOrganization } from '@repo/schemas';

export type OrganizationRow = {
  id: string;
  slug: string;
  name: string;
  catalogKind: ConsoleOrganization['catalogKind'];
  createdAt: Date;
};

export const organizationResource = (
  row: OrganizationRow,
  features: { activeFeatureCount: number; nextExpiry: Date | null },
): ConsoleOrganization => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  catalogKind: row.catalogKind,
  activeFeatureCount: features.activeFeatureCount,
  nextExpiry: features.nextExpiry?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});
