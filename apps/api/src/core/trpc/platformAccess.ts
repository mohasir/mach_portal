import { db } from '../../db';
import { platformAccessLog } from '../../db/schema';

// First-access query rows already written (or being written) per session and tenant. Holding the
// in-flight promise means a concurrent request waits for the same insert instead of skipping it,
// and a failed insert is evicted so the next request logs again: the audit trail may over-log
// but must never let a request run unlogged. In-memory on purpose: losing it on restart costs at
// most one extra row per session.
const MAX_ENTRIES = 10_000;
const firstAccess = new Map<string, Promise<void>>();

export function resetPlatformAccessSessions(): void {
  firstAccess.clear();
}

export async function recordPlatformAccess(input: {
  userId: string;
  tenantId: string;
  sessionId: string;
  path: string;
  type: 'query' | 'mutation';
}): Promise<void> {
  const insert = async () => {
    await db.insert(platformAccessLog).values({
      userId: input.userId,
      tenantId: input.tenantId,
      path: input.path,
      type: input.type,
    });
  };

  if (input.type === 'mutation') return insert();

  const key = `${input.sessionId}:${input.tenantId}`;
  const existing = firstAccess.get(key);
  if (existing) return existing;

  if (firstAccess.size >= MAX_ENTRIES) {
    // Map iterates in insertion order, so the first key is the oldest.
    const oldest = firstAccess.keys().next().value;
    if (oldest !== undefined) firstAccess.delete(oldest);
  }
  const pending = insert().catch((err: unknown) => {
    if (firstAccess.get(key) === pending) firstAccess.delete(key);
    throw err;
  });
  firstAccess.set(key, pending);
  return pending;
}
