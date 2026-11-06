import { eq } from 'drizzle-orm';
import { PgDialect, pgTable, text } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { tenantEq } from '../tenantEq';

const sample = pgTable('sample', { tenantId: text('tenant_id').notNull() });
const dialect = new PgDialect();

describe('tenantEq', () => {
  it('builds an equality filter on the tenantId column', () => {
    const actual = dialect.sqlToQuery(tenantEq(sample, 't1'));
    const expected = dialect.sqlToQuery(eq(sample.tenantId, 't1'));

    expect(actual).toEqual(expected);
    expect(actual.sql).toBe('"sample"."tenant_id" = $1');
    expect(actual.params).toEqual(['t1']);
  });
});
