import { organization } from '../../db/schema';

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
