import type { CatalogKind, TenantProfile } from '@repo/schemas';
import { organization } from '../../db/schema';
import { permissionsVersion, type ResolvedAccess } from '../../lib/rbac/access';

export const publicOrganizationColumns = {
  id: organization.id,
  slug: organization.slug,
  name: organization.name,
} as const;

export type PublicOrganization = { id: string; slug: string; name: string };

export const organizationResource = (org: PublicOrganization) => ({
  id: org.id,
  slug: org.slug,
  name: org.name,
});

export const organizationCollectionResource = (orgs: PublicOrganization[]) =>
  orgs.map(organizationResource);

export const permissionsResource = (access: ResolvedAccess) => ({
  isOwner: access.isOwner,
  grants: { ...access.grants },
  roleName: access.roleName,
  version: permissionsVersion(access),
});

export const tenantProfileResource = (catalogKind: CatalogKind): TenantProfile => ({ catalogKind });
