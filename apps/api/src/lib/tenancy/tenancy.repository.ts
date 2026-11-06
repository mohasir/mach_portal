import { and, eq } from 'drizzle-orm';
import { db, type Executor } from '../../db';
import { member, organization, user } from '../../db/schema';
import { normalizeSlug } from './slug';

// Global lookups on the organization/member/user identity tables. Those tables carry no
// tenant_id, so unlike a module repository this one takes no tenantId and can run where no
// request context exists (session hook, seeds, scripts, crons). The executor lets a caller bind
// it to its own transaction: `new TenancyRepository(tx)`.
export class TenancyRepository {
  constructor(private readonly executor: Executor = db) {}

  async findBySlug(slug: string) {
    const [row] = await this.executor
      .select({ id: organization.id, slug: organization.slug })
      .from(organization)
      .where(eq(organization.slug, normalizeSlug(slug)))
      .limit(1);
    return row;
  }

  async findById(id: string) {
    const [row] = await this.executor
      .select({ id: organization.id, slug: organization.slug, name: organization.name })
      .from(organization)
      .where(eq(organization.id, id))
      .limit(1);
    return row;
  }

  async isMemberOf(userId: string, tenantId: string): Promise<boolean> {
    const [row] = await this.executor
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.userId, userId), eq(member.organizationId, tenantId)))
      .limit(1);
    return row !== undefined;
  }

  // `limit` lets a caller that only needs to tell "none / one / several" stop early.
  async findMemberOrganizationIds(userId: string, limit: number): Promise<string[]> {
    const rows = await this.executor
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(limit);
    return rows.map((row) => row.organizationId);
  }

  async isPlatformAdmin(userId: string): Promise<boolean> {
    const [row] = await this.executor
      .select({ isPlatformAdmin: user.isPlatformAdmin })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.isPlatformAdmin === true;
  }
}
