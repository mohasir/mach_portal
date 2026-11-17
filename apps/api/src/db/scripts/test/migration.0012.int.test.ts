import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, runMigrate } from '../migrate';

const serverUrl = process.env['TEST_DATABASE_URL'];
if (!serverUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const TAG = '0012_product_descriptions';

const withDatabase = (name: string) => {
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return url.toString();
};

// A copy of the migrations folder that stops right before the given tag.
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

describe('0012 on a database with products that already have a description', () => {
  const name = `mt_descr_test_${randomBytes(6).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let dir: string;

  beforeAll(async () => {
    admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${name}`);
    dir = mkdtempSync(join(tmpdir(), 'mt-mig-0012-'));
    migrationsBefore(TAG, dir);
    await runMigrate(withDatabase(name), { migrationsFolder: dir });
    sql = postgres(withDatabase(name), { max: 1, onnotice: () => {} });
    await sql`INSERT INTO organization (id, name, slug, created_at) VALUES ('org_d', 'org_d', 'org-d', now())`;
    await sql`INSERT INTO units_of_measure (tenant_id, name, plural_name, code, dimension, factor)
              VALUES ('org_d', 'Persona', 'Personas', 'pers', 'quantity', 1)`;
    await sql`INSERT INTO products (tenant_id, name, description, uom_id)
              SELECT 'org_d', p.name, p.description, u.id
              FROM units_of_measure u, (VALUES ('A', 'Texto previo'), ('B', NULL)) AS p(name, description)
              WHERE u.tenant_id = 'org_d'`;
    await runMigrate(withDatabase(name));
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin?.end();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('keeps the previous text in short_description and leaves long_description empty', async () => {
    const rows = await sql`
      SELECT name, short_description, long_description FROM products ORDER BY name`;
    expect(rows).toEqual([
      { name: 'A', short_description: 'Texto previo', long_description: null },
      { name: 'B', short_description: null, long_description: null },
    ]);
  });

  it('no longer has the description column', async () => {
    const columns = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'products'`;
    expect(columns.map((c) => c['column_name'])).not.toContain('description');
  });
});
