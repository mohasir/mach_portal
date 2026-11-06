import { TRPCError } from '@trpc/server';
import { recordPlatformAccess } from '../../core/trpc/platformAccess';
import { AppError, ErrorCodes } from '../../lib/errors';
import { evaluateTenantAccess } from '../../lib/tenancy/access';
import type { Tenant } from '../../lib/tenancy/tenantResolver';
import { organizationCollectionResource, organizationResource } from './tenant.resource';
import type { TenantRepository } from './tenant.repository';

type Caller = { id: string; isPlatformAdmin?: boolean | null };

export class TenantService {
  constructor(private repo: TenantRepository) {}

  async active(user: Caller, tenant: Tenant | null) {
    if (!tenant) return null;
    const access = await evaluateTenantAccess({
      userId: user.id,
      isPlatformAdmin: user.isPlatformAdmin,
      tenantId: tenant.id,
    });
    if (!access.allowed) return null;
    return { ...organizationResource(tenant), isPlatformAccess: access.platformAccess };
  }

  async memberships(userId: string) {
    return organizationCollectionResource(await this.repo.findMembershipsByUserId(userId));
  }

  async listAll(user: Caller) {
    if (!user.isPlatformAdmin) throw new TRPCError({ code: 'FORBIDDEN' });
    return organizationCollectionResource(await this.repo.findAll());
  }

  async select(user: Caller, sessionId: string, organizationId: string, auditPath: string) {
    const access = await evaluateTenantAccess({
      userId: user.id,
      isPlatformAdmin: user.isPlatformAdmin,
      tenantId: organizationId,
    });
    if (!access.allowed) throw new TRPCError({ code: 'FORBIDDEN' });

    // Read past the tenant cache: a freshly created or deleted organization must be seen right away.
    const target = await this.repo.findById(organizationId);
    if (!target) {
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.tenant.NOT_FOUND) });
    }

    // Audited before the update so a failed audit write leaves the session untouched.
    if (access.platformAccess) {
      await recordPlatformAccess({
        userId: user.id,
        tenantId: target.id,
        sessionId,
        path: auditPath,
        type: 'mutation',
      });
    }

    // Scoped by the caller's own session id; the id never comes from the input.
    await this.repo.setSessionActiveOrganization(sessionId, target.id);

    return { ...organizationResource(target), isPlatformAccess: access.platformAccess };
  }
}
