import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, runMigrate } from '../migrate';

const serverUrl = process.env['TEST_DATABASE_URL'];
if (!serverUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const TAG = '0010_product_fields';

const withDatabase = (name: string) => {
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return url.toString();
};

// A copy of the migrations folder that stops right before 0010.
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

describe('0010 on a database with organizations, settings, products and roles', () => {
  const name = `mt_fields_test_${randomBytes(6).toString('hex')}`;
  // org_f_zero stored a minimum of 0, which the new CHECK would reject; org_f_none has no settings.
  // org_f_tiers: global 30 with tiered products, which keep their smallest tier usable.
  const tenants = ['org_f_a', 'org_f_b', 'org_f_zero', 'org_f_none', 'org_f_tiers'];
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let dir: string;

  beforeAll(async () => {
    admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${name}`);
    dir = mkdtempSync(join(tmpdir(), 'mt-mig-0010-'));
    migrationsBefore(TAG, dir);
    await runMigrate(withDatabase(name), { migrationsFolder: dir });
    sql = postgres(withDatabase(name), { max: 1, onnotice: () => {} });
    for (const id of tenants) {
      await sql`INSERT INTO organization (id, name, slug, created_at) VALUES (${id}, ${id}, ${id.replaceAll('_', '-')}, now())`;
      await sql`INSERT INTO units_of_measure (tenant_id, name, plural_name, code, dimension, factor)
                VALUES (${id}, 'Persona', 'Personas', 'pers', 'quantity', 1)`;
    }
    await sql`INSERT INTO app_settings (tenant_id, min_persons_per_line) VALUES
      ('org_f_a', 45), ('org_f_b', 12), ('org_f_zero', 0), ('org_f_tiers', 30)`;
    await sql`INSERT INTO products (tenant_id, name, uom_id)
      SELECT u.tenant_id, p.name, u.id FROM units_of_measure u
      JOIN (VALUES ('org_f_a', 'A1'), ('org_f_a', 'A2'), ('org_f_b', 'B1'), ('org_f_zero', 'Z1'),
                   ('org_f_none', 'N1'), ('org_f_tiers', 'T1'), ('org_f_tiers', 'T2'),
                   ('org_f_tiers', 'T3')) AS p(tenant_id, name) ON p.tenant_id = u.tenant_id`;
    await sql`INSERT INTO product_price_tiers (tenant_id, product_id, quantity, price)
      SELECT p.tenant_id, p.id, t.quantity, 100 FROM products p
      JOIN (VALUES ('T1', 10), ('T1', 20), ('T1', 25), ('T2', 40), ('T2', 50))
        AS t(name, quantity) ON t.name = p.name`;
    await sql`INSERT INTO role (id, tenant_id, name, is_owner) VALUES
      ('r_owner', 'org_f_a', 'Superadmin', true), ('r_admin', 'org_f_a', 'Admin', false),
      ('r_operator', 'org_f_a', 'Operator', false), ('r_custom', 'org_f_b', 'Catálogo', false),
      ('r_none', 'org_f_b', 'Sin catálogo', false)`;
    const grants: [string, string, string][] = [
      ...['create', 'read', 'update', 'delete', 'disable', 'duplicate'].map(
        (action): [string, string, string] => ['r_admin', 'product', action],
      ),
      ['r_operator', 'product', 'read'],
      ['r_custom', 'product', 'update'],
      ['r_custom', 'product', 'enable'],
      ['r_none', 'client', 'read'],
    ];
    for (const [roleId, resource, action] of grants) {
      await sql`INSERT INTO role_permission (role_id, tenant_id, resource, action)
                SELECT ${roleId}, tenant_id, ${resource}, ${action} FROM role WHERE id = ${roleId}`;
    }
    await sql`UPDATE role SET version = 3 WHERE id = 'r_admin'`;
    await runMigrate(withDatabase(name));
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin?.end();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('copies the minimum per line of each organization to its own products', async () => {
    const rows = await sql`SELECT tenant_id, name, min_quantity FROM products ORDER BY name`;
    expect(rows).toEqual([
      { tenant_id: 'org_f_a', name: 'A1', min_quantity: 45 },
      { tenant_id: 'org_f_a', name: 'A2', min_quantity: 45 },
      { tenant_id: 'org_f_b', name: 'B1', min_quantity: 12 },
      { tenant_id: 'org_f_none', name: 'N1', min_quantity: 1 },
      { tenant_id: 'org_f_tiers', name: 'T1', min_quantity: 10 },
      { tenant_id: 'org_f_tiers', name: 'T2', min_quantity: 30 },
      { tenant_id: 'org_f_tiers', name: 'T3', min_quantity: 30 },
      { tenant_id: 'org_f_zero', name: 'Z1', min_quantity: 1 },
    ]);
  });

  it('drops the organization setting', async () => {
    const columns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'app_settings'`;
    expect(columns.map((c) => c['column_name'])).not.toContain('min_persons_per_line');
  });

  it('leaves existing products without SKU, cost or category', async () => {
    const rows = await sql`SELECT DISTINCT sku, cost, category_id FROM products`;
    expect(rows).toEqual([{ sku: null, cost: null, category_id: null }]);
  });

  it('enforces the minimum, the cost and the SKU uniqueness', async () => {
    await expect(sql`UPDATE products SET min_quantity = 0 WHERE name = 'A1'`).rejects.toThrow(
      /products_min_quantity_check/,
    );
    await expect(sql`UPDATE products SET cost = -1 WHERE name = 'A1'`).rejects.toThrow(
      /products_cost_check/,
    );
    await sql`UPDATE products SET sku = 'AB-1' WHERE name = 'A1'`;
    await expect(sql`UPDATE products SET sku = 'ab-1' WHERE name = 'A2'`).rejects.toThrow(
      /products_tenant_sku_uidx/,
    );
    await sql`UPDATE products SET sku = 'ab-1' WHERE name = 'B1'`;
  });

  it('keeps category names unique per organization and restricts deleting a used one', async () => {
    const [cat] = await sql<{ id: string }[]>`
      INSERT INTO product_categories (tenant_id, name) VALUES ('org_f_a', 'Bebidas') RETURNING id`;
    await expect(
      sql`INSERT INTO product_categories (tenant_id, name) VALUES ('org_f_a', 'BEBIDAS')`,
    ).rejects.toThrow(/product_categories_tenant_name_uidx/);
    await sql`INSERT INTO product_categories (tenant_id, name) VALUES ('org_f_b', 'Bebidas')`;
    await sql`UPDATE products SET category_id = ${cat!.id} WHERE name = 'A1'`;
    await expect(sql`DELETE FROM product_categories WHERE id = ${cat!.id}`).rejects.toThrow(
      /products_category_id_product_categories_id_fk/,
    );
  });

  it('grants product_category at the product level and product_cost to roles that edit products', async () => {
    const rows = await sql<{ role_id: string; resource: string; actions: string[] }[]>`
      SELECT role_id, resource, array_agg(action ORDER BY action) AS actions
      FROM role_permission WHERE resource IN ('product_category', 'product_cost') AND scope = 'all'
      GROUP BY role_id, resource ORDER BY role_id, resource`;
    expect(rows).toEqual([
      {
        role_id: 'r_admin',
        resource: 'product_category',
        actions: ['create', 'delete', 'disable', 'read', 'update'],
      },
      { role_id: 'r_admin', resource: 'product_cost', actions: ['read', 'update'] },
      { role_id: 'r_custom', resource: 'product_category', actions: ['enable', 'update'] },
      { role_id: 'r_custom', resource: 'product_cost', actions: ['read', 'update'] },
      { role_id: 'r_operator', resource: 'product_category', actions: ['read'] },
    ]);
  });

  it('bumps the version only of the roles that gained a permission, once', async () => {
    const versions = await sql`SELECT id, version FROM role ORDER BY id`;
    expect(versions).toEqual([
      { id: 'r_admin', version: 4 },
      { id: 'r_custom', version: 2 },
      { id: 'r_none', version: 1 },
      { id: 'r_operator', version: 2 },
      { id: 'r_owner', version: 1 },
    ]);
  });

  it('forces row level security on the new table', async () => {
    const [row] = await sql`
      SELECT relrowsecurity AS enabled, relforcerowsecurity AS forced
      FROM pg_class WHERE oid = 'public.product_categories'::regclass`;
    expect(row).toEqual({ enabled: true, forced: true });
  });
});
