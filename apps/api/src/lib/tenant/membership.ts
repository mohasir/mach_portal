import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { member } from '../../db/schema';

export async function isMemberOf(userId: string, tenantId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, tenantId)))
    .limit(1);
  return row !== undefined;
}
