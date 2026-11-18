import { TRPCError } from '@trpc/server';
import type { SetConsoleCatalogKindInput } from '@repo/schemas';
import type { Database } from '../../../db';
import { recordPlatformAudit } from '../../../core/trpc/platformAudit';
import { AppError, ErrorCodes } from '../../../lib/errors';
import { setCatalogKind } from '../../../lib/tenancy/profile';
import { OrganizationsRepository } from '../organizations/organizations.repository';

export class ConsoleCatalogService {
  constructor(
    private organizations: OrganizationsRepository,
    private db: Database,
  ) {}

  async setKind(input: SetConsoleCatalogKindInput, actor: { userId: string }): Promise<void> {
    const org = await this.organizations.findById(input.organizationId);
    if (!org) {
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.tenant.NOT_FOUND) });
    }
    await this.db.transaction(async (tx) => {
      await setCatalogKind(tx, { tenantSlug: org.slug, kind: input.kind });
      await recordPlatformAudit(tx, {
        userId: actor.userId,
        action: 'catalog.set',
        tenantId: org.id,
        payload: { kind: input.kind },
      });
    });
  }
}
