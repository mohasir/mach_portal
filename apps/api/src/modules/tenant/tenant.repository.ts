import { eq } from 'drizzle-orm';
import type { Database } from '../../db';
import { member, organization, session } from '../../db/schema';
import { publicOrganizationColumns } from './tenant.resource';

// organization, member and session are global (not tenant-scoped) tables, so none of these
// methods take a tenantId: they are the lookups that decide which tenant a person may enter.
export class TenantRepository {
  constructor(private db: Database) {}

  findMembershipsByUserId(userId: string) {
    return this.db
      .select(publicOrganizationColumns)
      .from(member)
      .innerJoin(organization, eq(organization.id, member.organizationId))
      .where(eq(member.userId, userId))
      .orderBy(organization.name);
  }

  findAll() {
    return this.db.select(publicOrganizationColumns).from(organization).orderBy(organization.name);
  }

  async findById(id: string) {
    const [row] = await this.db
      .select(publicOrganizationColumns)
      .from(organization)
      .where(eq(organization.id, id))
      .limit(1);
    return row ?? null;
  }

  async setSessionActiveOrganization(sessionId: string, organizationId: string): Promise<void> {
    await this.db
      .update(session)
      .set({ activeOrganizationId: organizationId })
      .where(eq(session.id, sessionId));
  }
}
