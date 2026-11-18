import type { Database, Executor } from '../../db';
import { platformAuditLog, type PlatformAuditAction } from '../../db/schema';

// Written on the executor it receives so the row commits or rolls back with the change it records.
export async function recordPlatformAudit(
  executor: Executor,
  entry: {
    userId: string;
    action: PlatformAuditAction;
    tenantId?: string | null;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  await executor.insert(platformAuditLog).values({
    userId: entry.userId,
    action: entry.action,
    tenantId: entry.tenantId ?? null,
    payload: entry.payload ?? null,
  });
}

// Views already logged (or being logged) per session and organization. Holding the in-flight
// promise makes concurrent requests wait for the same insert, and a failed insert is evicted so
// the next request logs again: the trail may over-log but never skip. In-memory on purpose: a
// restart costs at most one extra row per session.
const MAX_ENTRIES = 10_000;
const viewed = new Map<string, Promise<void>>();

export function resetPlatformAuditSessions(): void {
  viewed.clear();
}

// Commits in a transaction of its own so the view stays logged even if the request fails later.
export function recordOrganizationView(
  entry: { userId: string; sessionId: string; tenantId: string },
  database: Database,
): Promise<void> {
  const key = `${entry.sessionId}:${entry.tenantId}`;
  const existing = viewed.get(key);
  if (existing) return existing;

  if (viewed.size >= MAX_ENTRIES) {
    // Map iterates in insertion order, so the first key is the oldest.
    const oldest = viewed.keys().next().value;
    if (oldest !== undefined) viewed.delete(oldest);
  }
  const pending = database
    .transaction((tx) =>
      recordPlatformAudit(tx, {
        userId: entry.userId,
        action: 'organization.view',
        tenantId: entry.tenantId,
      }),
    )
    .catch((err: unknown) => {
      if (viewed.get(key) === pending) viewed.delete(key);
      throw err;
    });
  viewed.set(key, pending);
  return pending;
}
