import { eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

export function tenantEq(table: { tenantId: PgColumn }, tenantId: string): SQL {
  return eq(table.tenantId, tenantId);
}
