import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_FOLDER, runMigrate } from '../migrate';

const serverUrl = process.env['TEST_DATABASE_URL'];
if (!serverUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const TAG = '0016_operating_location';

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

const untouchedColumns = (sql: postgres.Sql) => sql`
  SELECT number, address, total, notes FROM quotes ORDER BY number`;

describe('0016 on a database with states and cities', () => {
  const name = `mt_operating_location_test_${randomBytes(6).toString('hex')}`;
  let admin: postgres.Sql;
  let sql: postgres.Sql;
  let dir: string;
  let quotesBefore: postgres.RowList<postgres.Row[]>;

  beforeAll(async () => {
    admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
    await admin.unsafe(`CREATE DATABASE ${name}`);
    dir = mkdtempSync(join(tmpdir(), 'mt-mig-0016-'));
    migrationsBefore(TAG, dir);
    await runMigrate(withDatabase(name), { migrationsFolder: dir });
    sql = postgres(withDatabase(name), { max: 1, onnotice: () => {} });

    // org_a has quotes and an event with states, org_b only an event with a state, org_c quotes
    // without state and a client with one (clients alone do not enable the location).
    await sql`INSERT INTO organization (id, name, slug, created_at) VALUES
              ('org_a', 'org_a', 'org-a', now()), ('org_b', 'org_b', 'org-b', now()),
              ('org_c', 'org_c', 'org-c', now())`;
    await sql`INSERT INTO quote_stages (id, label, color, sort_order) VALUES (1, 'Pending', 'x', 1)
              ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO clients (tenant_id, name, city, state, address) VALUES
              ('org_a', 'Client A', 'Albany', 'NY', '1 Main St'),
              ('org_b', 'Client B', 'Newark', 'NJ', NULL),
              ('org_c', 'Client C', 'Hartford', 'CT', '9 Elm St')`;
    await sql`INSERT INTO quotes (tenant_id, seq, number, client_id, state, city, address, notes,
                total)
              SELECT v.tenant, v.seq, v.number, c.id, v.state::state, v.city, v.address, v.notes,
                     v.total
              FROM clients c JOIN (VALUES
                ('org_a', 1, 'A-NY', 'NY', 'New York', '5 Broadway', 'n1', 1000),
                ('org_a', 2, 'A-NJ', 'NJ', '  Hoboken ', '7 River St', NULL, 2000),
                ('org_a', 3, 'A-CT', 'CT', NULL, NULL, NULL, 3000),
                ('org_a', 4, 'A-NONE', NULL, 'Orphan City', '1 Nowhere', NULL, 4000),
                ('org_b', 1, 'B-NONE', NULL, NULL, NULL, NULL, 5000),
                ('org_c', 1, 'C-NONE', NULL, NULL, '3 Oak St', 'n2', 6000)
              ) AS v(tenant, seq, number, state, city, address, notes, total)
                ON v.tenant = c.tenant_id`;
    await sql`INSERT INTO events (tenant_id, quote_id, client_id, state, city, address, total_amount)
              SELECT q.tenant_id, q.id, q.client_id, 'NY', 'Yonkers', '2 Event Ave', q.total
              FROM quotes q WHERE q.number = 'A-NY'`;
    await sql`INSERT INTO events (tenant_id, quote_id, client_id, state, city, address, total_amount)
              SELECT q.tenant_id, q.id, q.client_id, 'NJ', 'Newark', NULL, q.total
              FROM quotes q WHERE q.number = 'B-NONE'`;
    await sql`INSERT INTO role (id, tenant_id, name, is_owner) VALUES
              ('r_owner', 'org_a', 'Superadmin', true), ('r_admin', 'org_a', 'Admin', false),
              ('r_viewer', 'org_a', 'Viewer', false), ('r_none', 'org_c', 'Clientes', false)`;
    await sql`INSERT INTO role_permission (role_id, tenant_id, resource, action, scope) VALUES
              ('r_admin', 'org_a', 'tax_rates', 'view', 'all'),
              ('r_admin', 'org_a', 'tax_rates', 'update', 'all'),
              ('r_viewer', 'org_a', 'tax_rates', 'view', 'all'),
              ('r_none', 'org_c', 'client', 'read', 'all')`;
    quotesBefore = await untouchedColumns(sql);
    await runMigrate(withDatabase(name));
  });

  afterAll(async () => {
    await sql?.end();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin?.end();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('copies each quote state and city to country, region and locality', async () => {
    const rows = await sql`
      SELECT number, country, region, locality FROM quotes ORDER BY tenant_id, number`;
    expect(rows.map((r) => [r['number'], r['country'], r['region'], r['locality']])).toEqual([
      ['A-CT', 'US', 'CT', null],
      ['A-NJ', 'US', 'NJ', 'Hoboken'],
      ['A-NONE', null, null, null],
      ['A-NY', 'US', 'NY', 'New York'],
      ['B-NONE', null, null, null],
      ['C-NONE', null, null, null],
    ]);
  });

  it('copies each event state and city the same way, keeping the address', async () => {
    const rows = await sql`
      SELECT tenant_id, country, region, locality, address FROM events ORDER BY tenant_id`;
    expect(rows).toEqual([
      {
        tenant_id: 'org_a',
        country: 'US',
        region: 'NY',
        locality: 'Yonkers',
        address: '2 Event Ave',
      },
      { tenant_id: 'org_b', country: 'US', region: 'NJ', locality: 'Newark', address: null },
    ]);
  });

  it('leaves every other stored quote field untouched', async () => {
    expect(await untouchedColumns(sql)).toEqual(quotesBefore);
  });

  it('enables the location only for organizations with a quote or event that had a state', async () => {
    const rows = await sql`
      SELECT tenant_id, enabled, country, depth, scope, ask_address FROM tenant_location
      ORDER BY tenant_id`;
    expect(rows).toEqual([
      {
        tenant_id: 'org_a',
        enabled: true,
        country: 'US',
        depth: 2,
        scope: 'country',
        ask_address: true,
      },
      {
        tenant_id: 'org_b',
        enabled: true,
        country: 'US',
        depth: 2,
        scope: 'country',
        ask_address: true,
      },
    ]);
    expect(await sql`SELECT * FROM tenant_location_areas`).toEqual([]);
  });

  it('drops state and city from clients, quotes and events, and the state enum', async () => {
    const columns = await sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('clients', 'quotes', 'events')
        AND column_name IN ('state', 'city')`;
    expect(columns).toEqual([]);
    const types = await sql`SELECT typname FROM pg_type WHERE typname = 'state'`;
    expect(types).toEqual([]);
    const clients = await sql`SELECT tenant_id, name, address FROM clients ORDER BY tenant_id`;
    expect(clients).toEqual([
      { tenant_id: 'org_a', name: 'Client A', address: '1 Main St' },
      { tenant_id: 'org_b', name: 'Client B', address: null },
      { tenant_id: 'org_c', name: 'Client C', address: '9 Elm St' },
    ]);
  });

  it('grants the location settings to the roles that see or edit tax rates', async () => {
    const rows = await sql`
      SELECT p.role_id, p.action, p.scope, r.version FROM role_permission p
      JOIN role r ON r.id = p.role_id
      WHERE p.resource = 'location_settings' ORDER BY p.role_id, p.action`;
    expect(rows.map((r) => [r['role_id'], r['action'], r['scope'], r['version']])).toEqual([
      ['r_admin', 'update', 'all', 2],
      ['r_admin', 'view', 'all', 2],
      ['r_viewer', 'view', 'all', 2],
    ]);
    const untouched = await sql`SELECT id, version FROM role WHERE id IN ('r_owner', 'r_none')
                                ORDER BY id`;
    expect(untouched).toEqual([
      { id: 'r_none', version: 1 },
      { id: 'r_owner', version: 1 },
    ]);
  });

  it('rejects an enabled row without country, depth or scope', async () => {
    await expect(
      sql`INSERT INTO tenant_location (tenant_id, enabled, country) VALUES ('org_c', true, 'US')`,
    ).rejects.toThrow(/tenant_location_enabled_complete_check/);
  });

  it('treats two region-wide areas of the same region as duplicates', async () => {
    await sql`INSERT INTO tenant_location (tenant_id) VALUES ('org_c')`;
    await sql`INSERT INTO tenant_location_areas (tenant_id, region) VALUES ('org_c', 'CT')`;
    await expect(
      sql`INSERT INTO tenant_location_areas (tenant_id, region) VALUES ('org_c', 'CT')`,
    ).rejects.toThrow(/tenant_location_areas_uidx/);
  });

  it('forces row level security on the new tables', async () => {
    const rows = await sql`
      SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relname IN ('tenant_location', 'tenant_location_areas') ORDER BY relname`;
    expect(rows).toEqual([
      { relname: 'tenant_location', relrowsecurity: true, relforcerowsecurity: true },
      { relname: 'tenant_location_areas', relrowsecurity: true, relforcerowsecurity: true },
    ]);
  });
});
