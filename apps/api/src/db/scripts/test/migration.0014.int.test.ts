import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, runMigrate } from '../migrate';

const serverUrl = process.env['TEST_DATABASE_URL'];
if (!serverUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const TAG = '0014_line_tax';

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

// Adds the given tag to that copy, so later migrations (which drop columns read here) stay out.
function addMigration(tag: string, dir: string) {
  const source = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8'));
  const target = JSON.parse(readFileSync(join(dir, 'meta/_journal.json'), 'utf8'));
  target.entries.push((source.entries as { tag: string }[]).find((e) => e.tag === tag));
  writeFileSync(join(dir, 'meta/_journal.json'), JSON.stringify(target));
  copyFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), join(dir, `${tag}.sql`));
}

const quoteTotals = (sql: postgres.Sql) => sql`
  SELECT number, subtotal, discount_amount, long_distance_amount, tax_amount,
         card_surcharge_amount, total, deposit_amount
  FROM quotes ORDER BY number`;

describe('0014 on a database with quotes taxed by state', () => {
  const name = `mt_line_tax_test_${randomBytes(6).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let dir: string;
  let totalsBefore: postgres.RowList<postgres.Row[]>;

  beforeAll(async () => {
    admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${name}`);
    dir = mkdtempSync(join(tmpdir(), 'mt-mig-0014-'));
    migrationsBefore(TAG, dir);
    await runMigrate(withDatabase(name), { migrationsFolder: dir });
    sql = postgres(withDatabase(name), { max: 1, onnotice: () => {} });

    await sql`INSERT INTO organization (id, name, slug, created_at)
              VALUES ('org_a', 'org_a', 'org-a', now()), ('org_b', 'org_b', 'org-b', now())`;
    await sql`INSERT INTO app_settings (tenant_id, apply_tax_by_state, prompt_rate_changes)
              VALUES ('org_a', true, true), ('org_b', false, false)`;
    await sql`INSERT INTO state_settings (tenant_id, state, tax_rate) VALUES ('org_a', 'NY', 0.08875)`;
    await sql`INSERT INTO units_of_measure (tenant_id, name, plural_name, code, dimension, factor)
              VALUES ('org_a', 'Persona', 'Personas', 'pers', 'quantity', 1),
                     ('org_b', 'Persona', 'Personas', 'pers', 'quantity', 1)`;
    await sql`INSERT INTO products (tenant_id, name, uom_id)
              SELECT tenant_id, 'Bar ' || tenant_id, id FROM units_of_measure`;
    await sql`INSERT INTO quote_stages (id, label, color, sort_order) VALUES (1, 'Pending', 'x', 1)
              ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO clients (tenant_id, name) VALUES ('org_a', 'Client'), ('org_b', 'Client')`;
    // Q-OLD: older quote at 6%. Q-NEW: latest taxed quote at 8.875%, whose stored tax also covered a
    // long distance amount, so it does not equal the tax of its lines. Q-ZERO: lines without price.
    // Q-EMPTY: no lines, with the tax the old formula charged on its long distance amount.
    // Q-DRAFT: the newest quote, an untaxed draft (no state yet), which must not set the default.
    await sql`INSERT INTO quotes (tenant_id, seq, number, client_id, subtotal, long_distance_amount,
                tax_rate, tax_amount, total, deposit_amount, declined_rates, created_at)
              SELECT 'org_a', v.seq, v.number, c.id, v.subtotal, v.ld, v.rate, v.tax, v.total,
                     v.deposit, v.declined::jsonb, v.created_at::timestamp
              FROM clients c, (VALUES
                (1, 'Q-OLD', 3000, 0, 0.06, 180, 3180, 1590, NULL, '2026-01-01'),
                (2, 'Q-NEW', 1000, 100, 0.08875, 98, 1198, 599, '{"taxRate":0.07}', '2026-03-01'),
                (3, 'Q-ZERO', 0, 0, 0.05, 7, 7, 4, NULL, '2026-02-01'),
                (4, 'Q-EMPTY', 0, 100, 0.08875, 9, 109, 55, NULL, '2026-02-15'),
                (5, 'Q-DRAFT', 0, 0, 0, 0, 0, 0, NULL, '2026-04-01')
              ) AS v(seq, number, subtotal, ld, rate, tax, total, deposit, declined, created_at)
              WHERE c.tenant_id = 'org_a'`;
    // org_b only has an untaxed quote: its default stays 0.
    await sql`INSERT INTO quotes (tenant_id, seq, number, client_id, tax_rate, created_at)
              SELECT 'org_b', 1, 'Q-B-UNTAXED', id, 0, '2026-05-01' FROM clients
              WHERE tenant_id = 'org_b'`;
    await sql`INSERT INTO quote_lines (tenant_id, quote_id, product_id, uom_id, quantity, subtotal, sort_order)
              SELECT 'org_a', q.id, p.id, p.uom_id, 1, v.subtotal, v.sort_order
              FROM quotes q, products p, (VALUES
                ('Q-OLD', 1000, 0), ('Q-OLD', 1000, 1), ('Q-OLD', 1000, 2),
                ('Q-NEW', 333, 0), ('Q-NEW', 333, 1), ('Q-NEW', 334, 2),
                ('Q-ZERO', 0, 0), ('Q-ZERO', 0, 1)
              ) AS v(number, subtotal, sort_order)
              WHERE q.number = v.number AND p.tenant_id = 'org_a'`;
    totalsBefore = await quoteTotals(sql);
    addMigration(TAG, dir);
    await runMigrate(withDatabase(name), { migrationsFolder: dir });
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin?.end();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('sets the default rate of each organization from its latest taxed quote, 0 without one', async () => {
    const rows = await sql`SELECT tenant_id, default_tax_rate FROM app_settings ORDER BY tenant_id`;
    expect(rows).toEqual([
      { tenant_id: 'org_a', default_tax_rate: '0.08875' },
      { tenant_id: 'org_b', default_tax_rate: '0.00000' },
    ]);
  });

  it('gives every product the default rate of its organization, not exempt', async () => {
    const rows = await sql`SELECT tenant_id, tax_rate, tax_exempt FROM products ORDER BY tenant_id`;
    expect(rows).toEqual([
      { tenant_id: 'org_a', tax_rate: '0.08875', tax_exempt: false },
      { tenant_id: 'org_b', tax_rate: '0.00000', tax_exempt: false },
    ]);
  });

  it('gives every line the rate of its quote and splits the stored tax exactly', async () => {
    const rows = await sql`
      SELECT q.number, l.tax_rate, l.tax_amount FROM quote_lines l JOIN quotes q ON q.id = l.quote_id
      ORDER BY q.number, l.sort_order`;
    expect(rows.map((r) => [r['number'], r['tax_rate'], r['tax_amount']])).toEqual([
      ['Q-NEW', '0.08875', 33],
      ['Q-NEW', '0.08875', 32],
      ['Q-NEW', '0.08875', 33],
      ['Q-OLD', '0.06000', 60],
      ['Q-OLD', '0.06000', 60],
      ['Q-OLD', '0.06000', 60],
      ['Q-ZERO', '0.05000', 7],
      ['Q-ZERO', '0.05000', 0],
    ]);
  });

  it('keeps the line taxes of every quote with lines adding up to its stored tax', async () => {
    // A quote without lines has nowhere to put its stored tax; reads report it apart (see
    // summarizeLineTaxes).
    const rows = await sql`
      SELECT q.number, coalesce(sum(l.tax_amount), 0)::int AS line_tax, q.tax_amount
      FROM quotes q LEFT JOIN quote_lines l ON l.quote_id = q.id
      GROUP BY q.id HAVING coalesce(sum(l.tax_amount), 0) <> q.tax_amount`;
    expect(rows).toEqual([{ number: 'Q-EMPTY', line_tax: 0, tax_amount: 9 }]);
  });

  it('leaves the stored quote totals untouched', async () => {
    expect(await quoteTotals(sql)).toEqual(totalsBefore);
  });

  it('drops the tax by state and the rate drift prompt', async () => {
    const [table] = await sql`SELECT to_regclass('public.state_settings') AS t`;
    expect(table!['t']).toBeNull();
    const columns = await sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (('app_settings', 'apply_tax_by_state'),
          ('app_settings', 'prompt_rate_changes'), ('quotes', 'tax_rate'),
          ('quotes', 'declined_rates'))`;
    expect(columns).toEqual([]);
  });

  it('makes the new columns required', async () => {
    const rows = await sql`
      SELECT table_name, column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (('app_settings', 'default_tax_rate'),
          ('products', 'tax_rate'), ('products', 'tax_exempt'), ('quote_lines', 'tax_rate'),
          ('quote_lines', 'tax_amount'))
      ORDER BY table_name, column_name`;
    expect(rows.every((r) => r['is_nullable'] === 'NO')).toBe(true);
    expect(rows).toHaveLength(5);
  });
});
