import { TRPCError } from '@trpc/server';
import {
  DEFAULT_CATALOG_KIND,
  paginationMeta,
  type ConsoleOrganizationListQuery,
  type CreateOrganizationInput,
} from '@repo/schemas';
import type { Database } from '../../../db';
import { recordOrganizationView, recordPlatformAudit } from '../../../core/trpc/platformAudit';
import { AppError, ErrorCodes } from '../../../lib/errors';
import { normalizeSlug } from '../../../lib/tenancy/slug';
import { createTenant } from '../../../lib/tenancy/createTenant';
import { OrganizationsRepository } from './organizations.repository';
import { organizationResource } from './organizations.resource';

type Actor = { userId: string };

export class OrganizationsService {
  constructor(
    private repo: OrganizationsRepository,
    private db: Database,
  ) {}

  async list(query: ConsoleOrganizationListQuery) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(query);
    const summaries = await this.repo.featureSummaries(items.map((o) => o.id));
    const resource = items.map((o) =>
      organizationResource(o, summaries.get(o.id) ?? { activeFeatureCount: 0, nextExpiry: null }),
    );
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async get(id: string, actor: Actor & { sessionId: string }) {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.tenant.NOT_FOUND) });
    }
    await recordOrganizationView(
      { userId: actor.userId, sessionId: actor.sessionId, tenantId: row.id },
      this.db,
    );
    const summaries = await this.repo.featureSummaries([row.id]);
    return organizationResource(
      row,
      summaries.get(row.id) ?? { activeFeatureCount: 0, nextExpiry: null },
    );
  }

  // Not in createTenant's transaction: it provisions the admin account outside one. The payload
  // leaves out the setup link, which is a credential.
  async create(input: CreateOrganizationInput, actor: Actor) {
    const result = await createTenant(input, this.db);
    await recordPlatformAudit(this.db, {
      userId: actor.userId,
      action: 'organization.create',
      tenantId: result.tenantId,
      payload: {
        slug: normalizeSlug(input.slug),
        name: input.name.trim(),
        adminEmail: input.adminEmail.trim().toLowerCase(),
        catalogKind: input.catalogKind ?? DEFAULT_CATALOG_KIND,
      },
    });
    return result;
  }
}
