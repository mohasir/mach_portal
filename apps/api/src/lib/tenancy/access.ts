import { TenancyRepository } from './tenancy.repository';

export type TenantAccess = { allowed: false } | { allowed: true; platformAccess: boolean };

// Single source of truth for "may this user enter this tenant", shared by the tRPC chain and the
// Express guard so both transports reach the same verdict. `platformAccess` is true only for a
// platform admin with no membership, who must be audited and acts as superadmin.
export async function evaluateTenantAccess(input: {
  userId: string;
  isPlatformAdmin: boolean | null | undefined;
  tenantId: string;
}): Promise<TenantAccess> {
  const member = await new TenancyRepository().isMemberOf(input.userId, input.tenantId);
  if (member) return { allowed: true, platformAccess: false };
  if (input.isPlatformAdmin) return { allowed: true, platformAccess: true };
  return { allowed: false };
}
