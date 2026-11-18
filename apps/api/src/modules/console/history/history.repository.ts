import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../../db';
import { platformAccessLog, platformAuditLog, tenantFeatureEvents, user } from '../../../db/schema';

// Runs on the platform client, which bypasses RLS: every query filters by organization itself.
export class HistoryRepository {
  constructor(private db: Database) {}

  featureEvents(organizationId: string, limit: number) {
    return this.db
      .select()
      .from(tenantFeatureEvents)
      .where(eq(tenantFeatureEvents.tenantId, organizationId))
      .orderBy(desc(tenantFeatureEvents.createdAt), desc(tenantFeatureEvents.id))
      .limit(limit);
  }

  accessLog(organizationId: string, limit: number) {
    return this.db
      .select({
        id: platformAccessLog.id,
        path: platformAccessLog.path,
        type: platformAccessLog.type,
        createdAt: platformAccessLog.createdAt,
        email: user.email,
      })
      .from(platformAccessLog)
      .innerJoin(user, eq(user.id, platformAccessLog.userId))
      .where(eq(platformAccessLog.tenantId, organizationId))
      .orderBy(desc(platformAccessLog.createdAt), desc(platformAccessLog.id))
      .limit(limit);
  }

  auditLog(organizationId: string, limit: number) {
    return this.db
      .select({
        id: platformAuditLog.id,
        action: platformAuditLog.action,
        payload: platformAuditLog.payload,
        createdAt: platformAuditLog.createdAt,
        email: user.email,
      })
      .from(platformAuditLog)
      .innerJoin(user, eq(user.id, platformAuditLog.userId))
      .where(eq(platformAuditLog.tenantId, organizationId))
      .orderBy(desc(platformAuditLog.createdAt), desc(platformAuditLog.id))
      .limit(limit);
  }
}
