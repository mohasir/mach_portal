import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, runMigrate } from '../migrate';

const serverUrl = process.env['TEST_DATABASE_URL'];
if (!serverUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const TAG = '0013_quote_line_units';

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

describe('0013 on a database with quote lines already saved', () => {
  const name = `mt_line_units_test_${randomBytes(6).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let dir: string;

  beforeAll(async () => {
    admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${name}`);
    dir = mkdtempSync(join(tmpdir(), 'mt-mig-0013-'));
    migrationsBefore(TAG, dir);
    await runMigrate(withDatabase(name), { migrationsFolder: dir });
    sql = postgres(withDatabase(name), { max: 1, onnotice: () => {} });
    await sql`INSERT INTO organization (id, name, slug, created_at) VALUES ('org_l', 'org_l', 'org-l', now())`;
    await sql`INSERT INTO units_of_measure (tenant_id, name, plural_name, code, dimension, factor)
              VALUES ('org_l', 'Persona', 'Personas', 'pers', 'quantity', 1),
                     ('org_l', 'Hora', 'Horas', 'h', 'time', 1)`;
    await sql`INSERT INTO products (tenant_id, name, uom_id)
              SELECT 'org_l', 'Per person', id FROM units_of_measure WHERE code = 'pers'`;
    await sql`INSERT INTO products (tenant_id, name, uom_id)
              SELECT 'org_l', 'Per hour', id FROM units_of_measure WHERE code = 'h'`;
    await sql`INSERT INTO quote_stages (id, label, color, sort_order) VALUES (1, 'Pending', 'x', 1)
              ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO clients (tenant_id, name) VALUES ('org_l', 'Client')`;
    await sql`INSERT INTO quotes (tenant_id, seq, number, client_id, tax_rate)
              SELECT 'org_l', 1, 'QUO-1', id, 0 FROM clients WHERE tenant_id = 'org_l'`;
    await sql`INSERT INTO quote_lines (tenant_id, quote_id, product_id, quantity, subtotal)
              SELECT 'org_l', q.id, p.id, 10, 1000
              FROM quotes q, products p WHERE q.tenant_id = 'org_l' AND p.tenant_id = 'org_l'`;
    await runMigrate(withDatabase(name));
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin?.end();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('gives every line the unit its product had, and none is left null', async () => {
    const rows = await sql`
      SELECT p.name, l.uom_id = p.uom_id AS same_unit, l.uom_id IS NULL AS missing
      FROM quote_lines l JOIN products p ON p.id = l.product_id ORDER BY p.name`;
    expect(rows).toEqual([
      { name: 'Per hour', same_unit: true, missing: false },
      { name: 'Per person', same_unit: true, missing: false },
    ]);
  });

  it('refuses to delete a unit that a line references', async () => {
    // The product moves on, so only the saved line still points at the unit.
    await sql`UPDATE products SET uom_id = (SELECT id FROM units_of_measure WHERE code = 'h')
              WHERE name = 'Per person'`;
    await expect(sql`DELETE FROM units_of_measure WHERE code = 'pers'`).rejects.toThrow(
      /quote_lines_uom_id_units_of_measure_id_fk/,
    );
  });

  it('indexes the line unit per tenant', async () => {
    const [index] = await sql`
      SELECT indexdef FROM pg_indexes
      WHERE tablename = 'quote_lines' AND indexname = 'quote_lines_tenant_uom_idx'`;
    expect(index!['indexdef']).toContain('(tenant_id, uom_id)');
  });

  it('makes the column required', async () => {
    const [column] = await sql`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'quote_lines' AND column_name = 'uom_id'`;
    expect(column).toEqual({ is_nullable: 'NO' });
  });
});
