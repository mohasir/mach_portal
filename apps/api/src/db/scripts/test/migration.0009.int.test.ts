import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizeDecimal, SYSTEM_UNITS } from '@repo/schemas';
import { MIGRATIONS_FOLDER, runMigrate } from '../migrate';

const serverUrl = process.env['TEST_DATABASE_URL'];
if (!serverUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const TAG = '0009_units_of_measure';

const withDatabase = (name: string) => {
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return url.toString();
};

// A copy of the migrations folder that stops right before 0009.
function migrationsBefore(tag: string, dir: string) {
  mkdirSync(join(dir, 'meta'));
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8'));
  const index = (journal.entries as { tag: string }[]).findIndex((e) => e.tag === tag);
  expect(index).toBeGreaterThan(0);
  journal.entries = journal.entries.slice(0, index);
  writeFileSync(join(dir, 'meta/_journal.json'), JSON.stringify(journal));
  for (const { tag: t } of journal.entries as { tag: string }[])
    copyFileSync(join(MIGRATIONS_FOLDER, `${t}.sql`), join(dir, `${t}.sql`));
}

const expectedUnits = SYSTEM_UNITS.map((u, sortOrder) => ({
  code: u.code,
  name: u.name,
  plural_name: u.pluralName,
  dimension: u.dimension,
  factor: u.factor,
  is_base: u.isBase,
  is_system: true,
  is_active: true,
  sort_order: sortOrder,
}));

describe('0009 on a database with organizations and products', () => {
  const name = `mt_uom_test_${randomBytes(6).toString('hex')}`;
  const tenants = ['org_uom_a', 'org_uom_b', 'org_uom_empty'];
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let dir: string;

  beforeAll(async () => {
    admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${name}`);
    dir = mkdtempSync(join(tmpdir(), 'mt-mig-0009-'));
    migrationsBefore(TAG, dir);
    await runMigrate(withDatabase(name), { migrationsFolder: dir });
    sql = postgres(withDatabase(name), { max: 1, onnotice: () => {} });
    for (const id of tenants) {
      await sql`INSERT INTO organization (id, name, slug, created_at) VALUES (${id}, ${id}, ${id.replaceAll('_', '-')}, now())`;
    }
    await sql`INSERT INTO products (tenant_id, name) VALUES
      ('org_uom_a', 'Producto A1'), ('org_uom_a', 'Producto A2'), ('org_uom_b', 'Producto B1')`;
    await sql`INSERT INTO role (id, tenant_id, name, is_owner) VALUES
      ('r_owner', 'org_uom_a', 'Superadmin', true), ('r_admin', 'org_uom_a', 'Admin', false),
      ('r_operator', 'org_uom_a', 'Operator', false), ('r_custom', 'org_uom_b', 'Catálogo', false),
      ('r_none', 'org_uom_b', 'Sin catálogo', false)`;
    const grants: [string, string, string][] = [
      ...['create', 'read', 'update', 'delete', 'disable', 'duplicate'].map(
        (action): [string, string, string] => ['r_admin', 'product', action],
      ),
      ['r_operator', 'product', 'read'],
      ['r_custom', 'product', 'read'],
      ['r_custom', 'product', 'enable'],
      ['r_none', 'client', 'read'],
    ];
    for (const [roleId, resource, action] of grants) {
      await sql`INSERT INTO role_permission (role_id, tenant_id, resource, action)
                SELECT ${roleId}, tenant_id, ${resource}, ${action} FROM role WHERE id = ${roleId}`;
    }
    await runMigrate(withDatabase(name));
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin?.end();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('inserts exactly SYSTEM_UNITS for every pre-existing organization', async () => {
    for (const tenant of tenants) {
      const rows = await sql`
        SELECT code, name, plural_name, dimension::text AS dimension, factor::text AS factor,
               is_base, is_system, is_active, sort_order
        FROM units_of_measure WHERE tenant_id = ${tenant} ORDER BY sort_order`;
      expect(
        rows.map((r) => ({ ...r, factor: normalizeDecimal(r['factor'] as string) })),
        tenant,
      ).toEqual(expectedUnits);
    }
    const [total] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM units_of_measure`;
    expect(total!.n).toBe(tenants.length * SYSTEM_UNITS.length);
  });

  it('stores the factors exactly', async () => {
    const rows = await sql<{ code: string; factor: string }[]>`
      SELECT code, factor::text AS factor FROM units_of_measure
      WHERE tenant_id = 'org_uom_a' AND code IN ('lb', 'oz', 'fl oz', 'gal', 'in', 'ft')
      ORDER BY sort_order`;
    expect(rows).toEqual([
      { code: 'lb', factor: '453.5923700000' },
      { code: 'oz', factor: '28.3495231250' },
      { code: 'fl oz', factor: '29.5735295625' },
      { code: 'gal', factor: '3785.4117840000' },
      { code: 'in', factor: '25.4000000000' },
      { code: 'ft', factor: '304.8000000000' },
    ]);
  });

  it('assigns the Persona unit of its own organization to every existing product', async () => {
    const rows = await sql`
      SELECT p.name, p.tenant_id = u.tenant_id AS same_tenant, u.code
      FROM products p JOIN units_of_measure u ON u.id = p.uom_id ORDER BY p.name`;
    expect(rows).toEqual([
      { name: 'Producto A1', same_tenant: true, code: 'pers' },
      { name: 'Producto A2', same_tenant: true, code: 'pers' },
      { name: 'Producto B1', same_tenant: true, code: 'pers' },
    ]);
  });

  it('leaves products.uom_id required and restricted', async () => {
    await expect(
      sql`INSERT INTO products (tenant_id, name) VALUES ('org_uom_a', 'Sin unidad')`,
    ).rejects.toThrow(/uom_id/);
    await expect(
      sql`DELETE FROM units_of_measure WHERE tenant_id = 'org_uom_a' AND code = 'pers'`,
    ).rejects.toThrow(/products_uom_id_units_of_measure_id_fk/);
  });

  it('enforces one base unit per dimension and the factor rules', async () => {
    await expect(
      sql`INSERT INTO units_of_measure (tenant_id, name, plural_name, code, dimension, factor, is_base)
          VALUES ('org_uom_a', 'Base 2', 'Bases 2', 'b2', 'time', 1, true)`,
    ).rejects.toThrow(/units_of_measure_one_base_per_dimension_uidx/);
    await expect(
      sql`INSERT INTO units_of_measure (tenant_id, name, plural_name, code, dimension, factor)
          VALUES ('org_uom_a', 'Cero', 'Ceros', 'zero', 'time', 0)`,
    ).rejects.toThrow(/units_of_measure_factor_check/);
  });

  it('grants unit_of_measure to existing roles at their product level', async () => {
    const rows = await sql<{ role_id: string; actions: string[]; scopes: string[] }[]>`
      SELECT role_id, array_agg(action ORDER BY action) AS actions,
             array_agg(DISTINCT scope::text) AS scopes
      FROM role_permission WHERE resource = 'unit_of_measure' GROUP BY role_id ORDER BY role_id`;
    expect(rows).toEqual([
      { role_id: 'r_admin', actions: ['create', 'disable', 'read', 'update'], scopes: ['all'] },
      { role_id: 'r_custom', actions: ['enable', 'read'], scopes: ['all'] },
      { role_id: 'r_operator', actions: ['read'], scopes: ['all'] },
    ]);
    const versions = await sql`SELECT id, version FROM role ORDER BY id`;
    expect(versions).toEqual([
      { id: 'r_admin', version: 2 },
      { id: 'r_custom', version: 2 },
      { id: 'r_none', version: 1 },
      { id: 'r_operator', version: 2 },
      { id: 'r_owner', version: 1 },
    ]);
  });

  it('forces row level security on the new table', async () => {
    const [row] = await sql`
      SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
      FROM pg_class WHERE oid = 'public.units_of_measure'::regclass`;
    expect(row).toEqual({ enabled: true, forced: true });
  });
});
