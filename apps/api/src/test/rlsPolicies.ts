import { is } from 'drizzle-orm';
import { getTableConfig, PgDialect, PgTable } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import type postgres from 'postgres';
import * as schema from '../db/schema';

const q = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`;

// drizzle-kit push creates policies without their USING / WITH CHECK expressions (it leaves them
// out of the push diff) and never forces RLS. This brings a pushed schema in line with what the
// migrations create, so suites that connect as the restricted role exercise the real policies.
export async function completePushedPolicies(sql: postgres.Sql): Promise<void> {
  const dialect = new PgDialect();
  const render = (expr: SQL) => {
    const query = dialect.sqlToQuery(expr);
    if (query.params.length > 0) throw new Error('Policy expressions must not take parameters');
    return query.sql;
  };
  const tables = Object.values(schema).filter((v) => is(v, PgTable)) as unknown as PgTable[];
  for (const table of tables) {
    const { name, policies, enableRLS } = getTableConfig(table);
    for (const policy of policies) {
      const clauses = [
        policy.using && `USING (${render(policy.using)})`,
        policy.withCheck && `WITH CHECK (${render(policy.withCheck)})`,
      ].filter(Boolean);
      if (clauses.length > 0) {
        await sql.unsafe(`ALTER POLICY ${q(policy.name)} ON ${q(name)} ${clauses.join(' ')}`);
      }
    }
    if (enableRLS || policies.length > 0) {
      await sql.unsafe(`ALTER TABLE ${q(name)} FORCE ROW LEVEL SECURITY`);
    }
  }
}
