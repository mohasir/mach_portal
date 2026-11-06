import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import * as schema from '../../schema';
import { TENANT_EXEMPT_TABLES } from '../../schema/tenantColumn';
import { TENANT_TABLES } from '../verifyMultitenant';

describe('verifyMultitenant TENANT_TABLES', () => {
  it('lists exactly the schema tables with tenant_id that are not exempt', () => {
    const fromSchema = (Object.values(schema).filter((v) => is(v, PgTable)) as unknown as PgTable[])
      .map((t) => getTableConfig(t))
      .filter((cfg) => cfg.columns.some((c) => c.name === 'tenant_id'))
      .map((cfg) => cfg.name)
      .filter((name) => !TENANT_EXEMPT_TABLES.includes(name))
      .sort();
    expect([...TENANT_TABLES].sort()).toEqual(fromSchema);
  });
});
