import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, runMigrate } from '../migrate';

const serverUrl = process.env['TEST_DATABASE_URL'];
if (!serverUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const TAG = '0015_extra_charges';

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

const quoteTotals = (sql: postgres.Sql) => sql`
  SELECT number, subtotal, discount_amount, tax_amount, total, deposit_amount
  FROM quotes ORDER BY number`;

describe('0015 on a database with long distance and card surcharges', () => {
  const name = `mt_extra_charges_test_${randomBytes(6).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let dir: string;
  let totalsBefore: postgres.RowList<postgres.Row[]>;

  beforeAll(async () => {
    admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${name}`);
    dir = mkdtempSync(join(tmpdir(), 'mt-mig-0015-'));
    migrationsBefore(TAG, dir);
    await runMigrate(withDatabase(name), { migrationsFolder: dir });
    sql = postgres(withDatabase(name), { max: 1, onnotice: () => {} });

    // org_a uses both, org_b only the surcharge (and has no settings row), org_c neither.
    await sql`INSERT INTO organization (id, name, slug, created_at) VALUES
              ('org_a', 'org_a', 'org-a', now()), ('org_b', 'org_b', 'org-b', now()),
              ('org_c', 'org_c', 'org-c', now())`;
    await sql`INSERT INTO app_settings (tenant_id, card_surcharge_rate)
              VALUES ('org_a', 0.05), ('org_c', 0.07)`;
    await sql`INSERT INTO quote_stages (id, label, color, sort_order) VALUES (1, 'Pending', 'x', 1)
              ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO clients (tenant_id, name)
              VALUES ('org_a', 'Client'), ('org_b', 'Client'), ('org_c', 'Client')`;
    await sql`INSERT INTO quotes (tenant_id, seq, number, client_id, subtotal, long_distance_amount,
                tax_amount, apply_card_surcharge, card_surcharge_rate, card_surcharge_amount, total,
                deposit_amount)
              SELECT v.tenant, v.seq, v.number, c.id, v.subtotal, v.ld, v.tax, v.card, v.rate,
                     v.surcharge, v.total, v.deposit
              FROM clients c JOIN (VALUES
                ('org_a', 1, 'A-LD', 10000, 2500, 1000, false, 0.09, 0, 13500, 6750),
                ('org_a', 2, 'A-BOTH', 10000, 500, 1000, true, 0.045, 495, 11995, 5998),
                ('org_a', 3, 'A-NONE', 10000, 0, 1000, false, 0.09, 0, 11000, 5500),
                ('org_b', 1, 'B-CARD', 20000, 0, 0, true, 0.03, 600, 20600, 10300),
                ('org_c', 1, 'C-NONE', 5000, 0, 0, false, 0.09, 0, 5000, 2500)
              ) AS v(tenant, seq, number, subtotal, ld, tax, card, rate, surcharge, total, deposit)
                ON v.tenant = c.tenant_id`;
    await sql`INSERT INTO role (id, tenant_id, name, is_owner) VALUES
              ('r_owner', 'org_a', 'Superadmin', true), ('r_admin', 'org_a', 'Admin', false),
              ('r_operator', 'org_a', 'Operator', false), ('r_none', 'org_c', 'Clientes', false)`;
    await sql`INSERT INTO role_permission (role_id, tenant_id, resource, action, scope) VALUES
              ('r_admin', 'org_a', 'tax_rates', 'update', 'all'),
              ('r_admin', 'org_a', 'quote', 'create', 'all'),
              ('r_operator', 'org_a', 'quote', 'create', 'own'),
              ('r_none', 'org_c', 'client', 'read', 'all')`;
    totalsBefore = await quoteTotals(sql);
    await runMigrate(withDatabase(name));
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin?.end();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('creates the charge types only in the organizations that used them', async () => {
    const rows = await sql`
      SELECT tenant_id, name, kind, default_value, is_active FROM charge_types
      ORDER BY tenant_id, sort_order`;
    expect(rows).toEqual([
      {
        tenant_id: 'org_a',
        name: 'Larga distancia',
        kind: 'fixed',
        default_value: '0.00000',
        is_active: true,
      },
      {
        tenant_id: 'org_a',
        name: 'Recargo por tarjeta',
        kind: 'percent',
        default_value: '0.05000',
        is_active: true,
      },
      {
        tenant_id: 'org_b',
        name: 'Recargo por tarjeta',
        kind: 'percent',
        default_value: '0.09000',
        is_active: true,
      },
    ]);
  });

  it('copies every used charge to its quote with the stored amount and rate', async () => {
    const rows = await sql`
      SELECT q.number, c.name, c.kind, c.value, c.amount, c.tenant_id = q.tenant_id AS same_tenant,
             t.tenant_id = q.tenant_id AND t.name = c.name AS typed
      FROM quote_charges c
      JOIN quotes q ON q.id = c.quote_id
      JOIN charge_types t ON t.id = c.charge_type_id
      ORDER BY q.number, c.sort_order`;
    expect(rows.map((r) => [r['number'], r['name'], r['kind'], r['value'], r['amount']])).toEqual([
      ['A-BOTH', 'Larga distancia', 'fixed', '500.00000', 500],
      ['A-BOTH', 'Recargo por tarjeta', 'percent', '0.04500', 495],
      ['A-LD', 'Larga distancia', 'fixed', '2500.00000', 2500],
      ['B-CARD', 'Recargo por tarjeta', 'percent', '0.03000', 600],
    ]);
    expect(rows.every((r) => r['same_tenant'] && r['typed'])).toBe(true);
  });

  it('enables extraCharges permanently and unpriced only where charges were migrated', async () => {
    const rows = await sql`
      SELECT tenant_id, enabled, expires_at, price_cents FROM tenant_features
      WHERE feature_key = 'extraCharges' ORDER BY tenant_id`;
    expect(rows).toEqual([
      { tenant_id: 'org_a', enabled: true, expires_at: null, price_cents: null },
      { tenant_id: 'org_b', enabled: true, expires_at: null, price_cents: null },
    ]);
  });

  it('leaves the stored quote totals untouched', async () => {
    expect(await quoteTotals(sql)).toEqual(totalsBefore);
  });

  it('keeps every quote total equal to its taxed total plus its charges', async () => {
    const rows = await sql`
      SELECT q.number FROM quotes q LEFT JOIN quote_charges c ON c.quote_id = q.id
      GROUP BY q.id
      HAVING q.subtotal - q.discount_amount + q.tax_amount + coalesce(sum(c.amount), 0) <> q.total`;
    expect(rows).toEqual([]);
  });

  it('grants charge types to the roles that edit tax rates or create quotes', async () => {
    const rows = await sql`
      SELECT p.role_id, p.action, p.scope, r.version FROM role_permission p
      JOIN role r ON r.id = p.role_id
      WHERE p.resource = 'charge_type' ORDER BY p.role_id, p.action`;
    expect(rows.map((r) => [r['role_id'], r['action'], r['scope'], r['version']])).toEqual([
      ['r_admin', 'create', 'all', 2],
      ['r_admin', 'disable', 'all', 2],
      ['r_admin', 'read', 'all', 2],
      ['r_admin', 'update', 'all', 2],
      ['r_operator', 'read', 'all', 2],
    ]);
    const untouched = await sql`SELECT id, version FROM role WHERE id IN ('r_owner', 'r_none')
                                ORDER BY id`;
    expect(untouched).toEqual([
      { id: 'r_none', version: 1 },
      { id: 'r_owner', version: 1 },
    ]);
  });

  it('drops long distance and the card surcharge columns', async () => {
    const columns = await sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (table_name, column_name) IN (('app_settings', 'card_surcharge_rate'),
          ('quotes', 'long_distance_amount'), ('quotes', 'apply_card_surcharge'),
          ('quotes', 'card_surcharge_rate'), ('quotes', 'card_surcharge_amount'))`;
    expect(columns).toEqual([]);
  });

  it('forces row level security on the new tables', async () => {
    const rows = await sql`
      SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relname IN ('charge_types', 'quote_charges') ORDER BY relname`;
    expect(rows).toEqual([
      { relname: 'charge_types', relrowsecurity: true, relforcerowsecurity: true },
      { relname: 'quote_charges', relrowsecurity: true, relforcerowsecurity: true },
    ]);
  });
});
