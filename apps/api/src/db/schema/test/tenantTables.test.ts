import { is } from 'drizzle-orm';
import { getTableConfig, index, PgTable, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { organization } from '../auth';
import * as schema from '../index';
import { TENANT_EXEMPT_TABLES } from '../tenantColumn';

const allTables = Object.values(schema).filter((v) => is(v, PgTable)) as unknown as PgTable[];

function tableName(table: PgTable) {
  return getTableConfig(table).name;
}

// Returns the reasons a table does not satisfy the tenant-scoping contract.
function tenantProblems(table: PgTable): string[] {
  const cfg = getTableConfig(table);
  const problems: string[] = [];
  const col = cfg.columns.find((c) => c.name === 'tenant_id');
  if (!col) return ['missing tenant_id column'];
  if (!col.notNull) problems.push('tenant_id is nullable');

  const fkToOrg = cfg.foreignKeys.some((fk) => {
    const ref = fk.reference();
    return (
      ref.columns.length === 1 &&
      ref.columns[0]?.name === 'tenant_id' &&
      getTableConfig(ref.foreignTable).name === 'organization' &&
      ref.foreignColumns[0]?.name === 'id'
    );
  });
  if (!fkToOrg) problems.push('tenant_id has no FK to organization.id');

  const inIndex = cfg.indexes.some((i) =>
    i.config.columns.some((c) => 'name' in c && c.name === 'tenant_id'),
  );
  const inUnique = cfg.uniqueConstraints.some((u) => u.columns.some((c) => c.name === 'tenant_id'));
  const inPk =
    col.primary || cfg.primaryKeys.some((p) => p.columns.some((c) => c.name === 'tenant_id'));
  if (!inIndex && !inUnique && !inPk) problems.push('no index/unique/PK includes tenant_id');
  return problems;
}

function find(name: string): PgTable {
  const t = allTables.find((x) => tableName(x) === name);
  if (!t) throw new Error(`table ${name} not found in schema`);
  return t;
}

function uniqueColumnSets(table: PgTable): string[][] {
  const cfg = getTableConfig(table);
  const sets = cfg.uniqueConstraints.map((u) => u.columns.map((c) => c.name));
  for (const i of cfg.indexes) {
    if (i.config.unique) {
      sets.push(i.config.columns.map((c) => ('name' in c ? c.name : '')) as string[]);
    }
  }
  for (const c of cfg.columns) {
    if (c.isUnique) sets.push([c.name]);
  }
  return sets;
}

function pkColumns(table: PgTable): string[] {
  const cfg = getTableConfig(table);
  if (cfg.primaryKeys.length) return cfg.primaryKeys[0]!.columns.map((c) => c.name);
  return cfg.columns.filter((c) => c.primary).map((c) => c.name);
}

function hasUnique(table: PgTable, cols: string[]) {
  return uniqueColumnSets(table).some(
    (s) => s.length === cols.length && cols.every((c) => s.includes(c)),
  );
}

describe('tenant scoping of the schema', () => {
  const scoped = allTables.filter((t) => !TENANT_EXEMPT_TABLES.includes(tableName(t)));

  it('finds the business tables', () => {
    expect(scoped.length).toBeGreaterThan(20);
  });

  it.each(scoped.map((t) => [tableName(t), t] as const))(
    '%s has a not-null tenant_id FK to organization and a tenant index',
    (_name, table) => {
      expect(tenantProblems(table)).toEqual([]);
    },
  );

  it('keeps the exempt list in sync with the schema', () => {
    const names = allTables.map(tableName);
    for (const exempt of TENANT_EXEMPT_TABLES) {
      expect(names, exempt).toContain(exempt);
    }
  });

  it('exempts exactly the global tables', () => {
    expect([...TENANT_EXEMPT_TABLES].sort()).toEqual(
      [
        'user',
        'session',
        'account',
        'verification',
        'organization',
        'member',
        'invitation',
        'quote_stages',
        'platform_access_log',
      ].sort(),
    );
  });

  describe('checker meta-tests (fake tables)', () => {
    const idCol = () => uuid('id').primaryKey();
    const other = pgTable('other', { id: text('id').primaryKey() });

    it('flags a table without tenant_id', () => {
      const fake = pgTable('fake_table', { id: idCol(), name: text('name') });
      expect(tenantProblems(fake)).toEqual(['missing tenant_id column']);
    });

    it('flags a nullable tenant_id', () => {
      const fake = pgTable(
        'fake_nullable',
        { id: idCol(), tenantId: text('tenant_id').references(() => organization.id) },
        (t) => [index('fake_nullable_idx').on(t.tenantId)],
      );
      expect(tenantProblems(fake)).toEqual(['tenant_id is nullable']);
    });

    it('flags a tenant_id without FK', () => {
      const fake = pgTable(
        'fake_no_fk',
        { id: idCol(), tenantId: text('tenant_id').notNull() },
        (t) => [index('fake_no_fk_idx').on(t.tenantId)],
      );
      expect(tenantProblems(fake)).toEqual(['tenant_id has no FK to organization.id']);
    });

    it('flags a tenant_id whose FK targets another table or column', () => {
      const otherTable = pgTable(
        'fake_other_table',
        {
          id: idCol(),
          tenantId: text('tenant_id')
            .notNull()
            .references(() => other.id),
        },
        (t) => [index('fake_other_table_idx').on(t.tenantId)],
      );
      const otherColumn = pgTable(
        'fake_other_column',
        {
          id: idCol(),
          tenantId: text('tenant_id')
            .notNull()
            .references(() => organization.slug),
        },
        (t) => [index('fake_other_column_idx').on(t.tenantId)],
      );
      expect(tenantProblems(otherTable)).toEqual(['tenant_id has no FK to organization.id']);
      expect(tenantProblems(otherColumn)).toEqual(['tenant_id has no FK to organization.id']);
    });

    it('flags a tenant_id that no index, PK or unique includes', () => {
      const fake = pgTable(
        'fake_no_index',
        {
          id: idCol(),
          tenantId: text('tenant_id')
            .notNull()
            .references(() => organization.id),
        },
        (t) => [index('fake_no_index_other_idx').on(t.id)],
      );
      expect(tenantProblems(fake)).toEqual(['no index/unique/PK includes tenant_id']);
    });

    it('accepts a well-formed table (index, unique or PK)', () => {
      const col = () =>
        text('tenant_id')
          .notNull()
          .references(() => organization.id);
      const indexed = pgTable('fake_ok_idx', { id: idCol(), tenantId: col() }, (t) => [
        index('fake_ok_idx_tenant').on(t.tenantId),
      ]);
      const uniqued = pgTable('fake_ok_uq', { id: idCol(), tenantId: col() }, (t) => [
        unique('fake_ok_uq_u').on(t.tenantId, t.id),
      ]);
      const pk = pgTable('fake_ok_pk', { tenantId: col().primaryKey() });
      expect(tenantProblems(indexed)).toEqual([]);
      expect(tenantProblems(uniqued)).toEqual([]);
      expect(tenantProblems(pk)).toEqual([]);
    });

    it('hasUnique distinguishes tenant-scoped from global uniques', () => {
      const scoped = pgTable(
        'fake_scoped',
        { tenantId: text('tenant_id').notNull(), name: text('name').notNull() },
        (t) => [unique('fake_scoped_u').on(t.tenantId, t.name)],
      );
      const global = pgTable('fake_global', {
        tenantId: text('tenant_id').notNull(),
        name: text('name').notNull().unique(),
      });
      expect(hasUnique(scoped, ['tenant_id', 'name'])).toBe(true);
      expect(hasUnique(scoped, ['name'])).toBe(false);
      expect(hasUnique(global, ['tenant_id', 'name'])).toBe(false);
      expect(hasUnique(global, ['name'])).toBe(true);
    });
  });

  describe('uniqueness is per tenant', () => {
    it.each([
      ['event_types', ['tenant_id', 'name']],
      ['products', ['tenant_id', 'name']],
      ['reschedule_reasons', ['tenant_id', 'name']],
      ['quotes', ['tenant_id', 'seq']],
      ['quotes', ['tenant_id', 'number']],
      ['templates', ['tenant_id', 'type', 'locale']],
    ])('%s is unique on %j', (name, cols) => {
      expect(hasUnique(find(name), cols)).toBe(true);
    });

    it.each([
      ['event_types', ['name']],
      ['products', ['name']],
      ['reschedule_reasons', ['name']],
      ['quotes', ['seq']],
      ['quotes', ['number']],
      ['templates', ['type', 'locale']],
    ])('%s has no global unique on %j', (name, cols) => {
      expect(hasUnique(find(name), cols)).toBe(false);
    });

    it('app_settings has tenant_id as primary key and no singleton id', () => {
      expect(pkColumns(find('app_settings'))).toEqual(['tenant_id']);
      expect(getTableConfig(find('app_settings')).columns.map((c) => c.name)).not.toContain('id');
    });

    it('state_settings is keyed by (tenant_id, state)', () => {
      expect([...pkColumns(find('state_settings'))].sort()).toEqual(['state', 'tenant_id']);
    });

    it('user_preferences is keyed by (tenant_id, user_id)', () => {
      expect([...pkColumns(find('user_preferences'))].sort()).toEqual(['tenant_id', 'user_id']);
    });
  });
});
