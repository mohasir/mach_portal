import { eq } from 'drizzle-orm';
import type { Database } from '../../../db';
import { tenantFeatures } from '../../../db/schema';

// Runs on the platform client, so every query names the organization it reads.
export class ConsoleFeaturesRepository {
  constructor(private db: Database) {}

  findByOrganization(organizationId: string) {
    return this.db.select().from(tenantFeatures).where(eq(tenantFeatures.tenantId, organizationId));
  }
}
