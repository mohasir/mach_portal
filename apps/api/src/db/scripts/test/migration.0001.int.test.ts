import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { markBaseline } from '../markBaseline';
import { MIGRATIONS_FOLDER, runMigrate } from '../migrate';
import { TENANT_TABLES, verifyMultitenant } from '../verifyMultitenant';
import { LEGACY_APP_SETTINGS, LEGACY_USERS, loadLegacyData } from './legacyFixture';

const serverUrl = process.env['TEST_DATABASE_URL'];
if (!serverUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const API_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const SLUG = 'mach-bar';
const NAME = "Mach Bar O'Neil  Eventos";
const TENANT_SETTINGS = { 'mt.tenant_slug': SLUG, 'mt.tenant_name': NAME };

const LEGACY_TABLE_COUNT = 30;

const created: string[] = [];
const tmpDirs: string[] = [];
let admin: postgres.Sql;
let baselineOnly: string;

const withDatabase = (name: string) => {
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return url.toString();
};

async function createDb() {
  const name = `mt_mig_test_${randomBytes(6).toString('hex')}`;
  await admin.unsafe(`CREATE DATABASE ${name}`);
  created.push(name);
  const url = withDatabase(name);
  return { url, sql: postgres(url, { max: 1, onnotice: () => {} }) };
}

function baselineOnlyFolder() {
  const dir = mkdtempSync(join(tmpdir(), 'mt-mig-0000-'));
  tmpDirs.push(dir);
  mkdirSync(join(dir, 'meta'));
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8'));
  journal.entries = journal.entries.slice(0, 1);
  writeFileSync(join(dir, 'meta/_journal.json'), JSON.stringify(journal));
  copyFileSync(join(MIGRATIONS_FOLDER, '0000_baseline.sql'), join(dir, '0000_baseline.sql'));
  return dir;
}

async function legacyDb({ withData }: { withData: boolean }) {
  const db = await createDb();
  await runMigrate(db.url, { migrationsFolder: baselineOnly });
  if (withData) await loadLegacyData(db.sql);
  return db;
}

async function publicTables(sql: postgres.Sql) {
  const rows = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
  return rows.map((r) => r.table_name);
}

async function countRows(sql: postgres.Sql, tables: string[]) {
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const [row] = await sql.unsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "${t}"`);
    counts[t] = row!.n;
  }
  return counts;
}

async function columnsOf(sql: postgres.Sql, table: string) {
  const rows = await sql<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table} ORDER BY ordinal_position`;
  return rows.map((r) => r.column_name);
}

type Fingerprints = Record<string, string>;

async function fingerprint(sql: postgres.Sql, table: string, columns: string[]) {
  const cols = columns.map((c) => `"${c}"`).join(', ');
  const [row] = await sql.unsafe<{ h: string }[]>(
    `SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) AS h
     FROM (SELECT ${cols} FROM "${table}") t`,
  );
  return row!.h;
}

/** Fingerprints of every table over the given column sets (legacy columns by default). */
async function fingerprints(sql: postgres.Sql, columnSets: Record<string, string[]>) {
  const result: Fingerprints = {};
  for (const [table, columns] of Object.entries(columnSets)) {
    result[table] = await fingerprint(sql, table, columns);
  }
  return result;
}

async function legacyColumnSets(sql: postgres.Sql) {
  const sets: Record<string, string[]> = {};
  for (const t of await publicTables(sql)) sets[t] = await columnsOf(sql, t);
  return sets;
}

async function schemaDump(sql: postgres.Sql) {
  const columns = await sql`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
           character_maximum_length, numeric_precision, numeric_scale
    FROM information_schema.columns WHERE table_schema = 'public'
    ORDER BY table_name, column_name`;
  const constraints = await sql`
    SELECT conrelid::regclass::text AS tbl, conname, contype::text AS contype,
           pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace
    ORDER BY 1, 2`;
  const indexes = await sql`
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' ORDER BY 1, 2`;
  const enums = await sql`
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typnamespace = 'public'::regnamespace GROUP BY t.typname ORDER BY 1`;
  return { columns, constraints, indexes, enums };
}

// Drizzle's error message repeats the failed statement (which contains the expected words), so
// the assertion targets the database error carried in `cause`.
async function expectMigrationError(promise: Promise<unknown>, reason: RegExp) {
  await expect(promise).rejects.toMatchObject({
    cause: { message: expect.stringMatching(reason) },
  });
}

async function tableExists(sql: postgres.Sql, table: string) {
  const [row] = await sql`SELECT to_regclass(${'public.' + table}) AS t`;
  return row!['t'] !== null;
}

async function migrationRows(sql: postgres.Sql) {
  return sql<{ hash: string }[]>`SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id`;
}

beforeAll(() => {
  admin = postgres(serverUrl, { max: 1, onnotice: () => {} });
  baselineOnly = baselineOnlyFolder();
});

afterAll(async () => {
  for (const name of created) await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.end();
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

describe('0001 on a legacy database with data', () => {
  let db: { url: string; sql: postgres.Sql };
  let legacyTables: string[];
  let legacyCounts: Record<string, number>;
  let legacySets: Record<string, string[]>;
  let legacyPrints: Fingerprints;
  // Legacy columns that still exist after 0001 (only app_settings.id is dropped).
  let survivingSets: Record<string, string[]>;
  let survivingPrints: Fingerprints;
  let orgId: string;

  beforeAll(async () => {
    db = await legacyDb({ withData: true });
    legacyTables = await publicTables(db.sql);
    legacyCounts = await countRows(db.sql, legacyTables);
    legacySets = await legacyColumnSets(db.sql);
    legacyPrints = await fingerprints(db.sql, legacySets);
    survivingSets = {
      ...legacySets,
      app_settings: legacySets['app_settings']!.filter((c) => c !== 'id'),
    };
    survivingPrints = await fingerprints(db.sql, survivingSets);
  });

  afterAll(async () => {
    await db.sql.end();
  });

  it('starts from the full legacy schema with rows in every table', () => {
    expect(legacyTables).toHaveLength(LEGACY_TABLE_COUNT);
    for (const t of legacyTables) expect(legacyCounts[t], t).toBeGreaterThan(0);
  });

  it('pre-verifies the legacy schema with the same counts and no problems', async () => {
    const report = await verifyMultitenant(db.url, { pre: true });
    expect(report.problems).toEqual([]);
    expect(report.counts).toEqual(legacyCounts);
  });

  it('refuses to run without the tenant parameters and leaves the database untouched', async () => {
    const before = await schemaDump(db.sql);
    await expectMigrationError(runMigrate(db.url), /needs the tenant #1 slug/);
    expect(await schemaDump(db.sql)).toEqual(before);
    expect(await fingerprints(db.sql, legacySets)).toEqual(legacyPrints);
    expect(await migrationRows(db.sql)).toHaveLength(1);
  });

  it('refuses a missing tenant name and rolls back', async () => {
    const before = await schemaDump(db.sql);
    await expectMigrationError(
      runMigrate(db.url, { settings: { 'mt.tenant_slug': SLUG } }),
      /needs the tenant #1 name/,
    );
    expect(await schemaDump(db.sql)).toEqual(before);
    expect(await fingerprints(db.sql, legacySets)).toEqual(legacyPrints);
    expect(await migrationRows(db.sql)).toHaveLength(1);
  });

  it('refuses an invalid slug and rolls back', async () => {
    const before = await schemaDump(db.sql);
    await expectMigrationError(
      runMigrate(db.url, { settings: { ...TENANT_SETTINGS, 'mt.tenant_slug': 'Mach_Bar' } }),
      /Invalid tenant slug "Mach_Bar"/,
    );
    expect(await schemaDump(db.sql)).toEqual(before);
    expect(await fingerprints(db.sql, legacySets)).toEqual(legacyPrints);
    expect(await migrationRows(db.sql)).toHaveLength(1);
  });

  it('migrates with the tenant parameters', async () => {
    await runMigrate(db.url, { settings: TENANT_SETTINGS });
    const orgs = await db.sql<{ id: string; slug: string; name: string }[]>`
      SELECT id, slug, name FROM organization`;
    expect(orgs).toHaveLength(1);
    expect(orgs[0]).toMatchObject({ slug: SLUG, name: NAME });
    orgId = orgs[0]!.id;
    expect(await migrationRows(db.sql)).toHaveLength(2);
  });

  it('keeps every legacy row and adds only the organization and its members', async () => {
    const counts = await countRows(db.sql, await publicTables(db.sql));
    expect(counts).toEqual({
      ...legacyCounts,
      organization: 1,
      member: LEGACY_USERS.length,
      invitation: 0,
      platform_access_log: 0,
      quote_stage_settings: legacyCounts['quote_stages'],
    });
  });

  it('keeps the content of every legacy column', async () => {
    expect(await fingerprints(db.sql, survivingSets)).toEqual(survivingPrints);
  });

  it('assigns every business row to the new organization', async () => {
    for (const t of TENANT_TABLES) {
      const rows = await db.sql.unsafe<{ tenant_id: string | null; n: number }[]>(
        `SELECT tenant_id, count(*)::int AS n FROM "${t}" GROUP BY tenant_id`,
      );
      const n = t === 'quote_stage_settings' ? legacyCounts['quote_stages'] : legacyCounts[t];
      expect(rows, t).toEqual([{ tenant_id: orgId, n }]);
    }
  });

  it("moves the legacy quote stage wording into tenant #1's overlay", async () => {
    const overlay = await db.sql`
      SELECT tenant_id, stage_id, label, color, description FROM quote_stage_settings ORDER BY stage_id`;
    const stages = await db.sql`
      SELECT ${orgId}::text AS tenant_id, id AS stage_id, label, color, description
      FROM quote_stages ORDER BY id`;
    expect(overlay).toEqual(stages);
    expect(overlay.length).toBe(legacyCounts['quote_stages']);
  });

  it('creates one membership per user with the same role', async () => {
    const rows = await db.sql<{ user_id: string; role: string; organization_id: string }[]>`
      SELECT user_id, role, organization_id FROM member ORDER BY user_id`;
    const expected = [...LEGACY_USERS]
      .map((u) => ({ user_id: u.id, role: u.role ?? 'member', organization_id: orgId }))
      .sort((a, b) => a.user_id.localeCompare(b.user_id));
    expect(rows).toEqual(expected);
  });

  it('marks exactly the superadmins as platform admins', async () => {
    const rows = await db.sql<{ id: string }[]>`
      SELECT id FROM "user" WHERE is_platform_admin ORDER BY id`;
    expect(rows.map((r) => r.id)).toEqual(['usr_super']);
    const [nulls] = await db.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "user" WHERE is_platform_admin IS NULL`;
    expect(nulls!.n).toBe(0);
  });

  it('activates the organization on every existing session', async () => {
    const rows = await db.sql`SELECT DISTINCT active_organization_id AS org FROM session`;
    expect(rows).toEqual([{ org: orgId }]);
  });

  it('turns the app_settings singleton into the tenant row with the original values', async () => {
    const [row] = await db.sql`
      SELECT tenant_id, deposit_rate::text, quote_validity_months, min_persons_per_line,
             quote_seq_start, currency, catalog_sortable, options_selection_deadline_days,
             allow_select_options_at_quote, prompt_rate_changes, hide_stale_quotes,
             apply_tax_by_state, card_surcharge_rate::text,
             to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at
      FROM app_settings`;
    expect(row).toEqual({ tenant_id: orgId, ...LEGACY_APP_SETTINGS });
    expect(await columnsOf(db.sql, 'app_settings')).not.toContain('id');
  });

  it('keeps quote numbering and enforces the per-tenant uniques', async () => {
    const quotes = await db.sql`SELECT seq, number FROM quotes ORDER BY seq`;
    expect(quotes.map((q) => q['seq'])).toEqual([1001, 1002, 1003]);
    await expect(db.sql`UPDATE quotes SET seq = 1001 WHERE seq = 1002`).rejects.toThrow(
      /quotes_tenant_seq_unique/,
    );
    await expect(
      db.sql`INSERT INTO products (tenant_id, name) VALUES (${orgId}, 'Tacos')`,
    ).rejects.toThrow(/products_tenant_name_unique/);
    await expect(
      db.sql`INSERT INTO member (id, organization_id, user_id, role, created_at)
             VALUES ('dup', ${orgId}, 'usr_admin', 'admin', now())`,
    ).rejects.toThrow(/member_organizationId_userId_uidx/);
  });

  it('passes the post-migration verification with the same counts', async () => {
    const report = await verifyMultitenant(db.url);
    expect(report.problems).toEqual([]);
    expect(report.counts).toMatchObject(legacyCounts);
  });

  it('changes nothing when run again', async () => {
    const tables = await publicTables(db.sql);
    const before = {
      schema: await schemaDump(db.sql),
      prints: await fingerprints(db.sql, await legacyColumnSets(db.sql)),
    };
    await runMigrate(db.url, { settings: TENANT_SETTINGS });
    await runMigrate(db.url);
    expect(await schemaDump(db.sql)).toEqual(before.schema);
    expect(await fingerprints(db.sql, await legacyColumnSets(db.sql))).toEqual(before.prints);
    expect(await publicTables(db.sql)).toEqual(tables);
    expect(await migrationRows(db.sql)).toHaveLength(2);
  });

  it('flags a child row whose tenant differs from its parent', async () => {
    const other = 'org_other';
    await db.sql`INSERT INTO organization (id, name, slug, created_at)
                 VALUES (${other}, 'Other', 'other-tenant', now())`;
    await db.sql`UPDATE quote_lines SET tenant_id = ${other}
                 WHERE id = (SELECT id FROM quote_lines ORDER BY id LIMIT 1)`;
    const report = await verifyMultitenant(db.url);
    expect(report.problems.join('\n')).toMatch(/quote_lines.*quotes/);
  });
});

describe('0001 backfill edge cases', () => {
  it('requires the parameters when only business tables have rows', async () => {
    const db = await legacyDb({ withData: false });
    await db.sql`INSERT INTO clients (name) VALUES ('no users yet')`;
    await expectMigrationError(runMigrate(db.url), /needs the tenant #1 slug/);
    expect(await tableExists(db.sql, 'organization')).toBe(false);
    expect(await migrationRows(db.sql)).toHaveLength(1);
    await db.sql.end();
  });

  it('refuses app_settings rows other than the singleton and rolls back', async () => {
    const db = await legacyDb({ withData: true });
    await db.sql`INSERT INTO app_settings (id) VALUES (2)`;
    const pre = await verifyMultitenant(db.url, { pre: true });
    expect(pre.problems.join('\n')).toMatch(/app_settings: 1 row\(s\) other than the singleton/);
    const before = await schemaDump(db.sql);
    await expectMigrationError(
      runMigrate(db.url, { settings: TENANT_SETTINGS }),
      /app_settings has rows other than the singleton/,
    );
    expect(await schemaDump(db.sql)).toEqual(before);
    expect(await migrationRows(db.sql)).toHaveLength(1);
    await db.sql.end();
  });

  it.each(['', '   '])('refuses the tenant name %j', async (name) => {
    const db = await legacyDb({ withData: true });
    await expectMigrationError(
      runMigrate(db.url, { settings: { ...TENANT_SETTINGS, 'mt.tenant_name': name } }),
      /needs the tenant #1 name/,
    );
    expect(await tableExists(db.sql, 'organization')).toBe(false);
    await db.sql.end();
  });

  it('handles multi-role, empty and misspelled roles, and a missing app_settings row', async () => {
    const db = await legacyDb({ withData: false });
    await db.sql`
      INSERT INTO "user" (id, name, email, role) VALUES
        ('u_multi', 'm', 'multi@x.test', 'admin,superadmin'),
        ('u_empty', 'e', 'empty@x.test', ''),
        ('u_typo', 't', 'typo@x.test', 'SuperAdmin')`;
    const pre = await verifyMultitenant(db.url, { pre: true });
    expect(pre.problems).toEqual([
      'user typo@x.test: role "SuperAdmin" is not exactly "superadmin" and would not become a platform admin',
    ]);
    expect(pre.notes).toContain('user roles: =1, SuperAdmin=1, admin,superadmin=1');
    expect(pre.notes.join('\n')).toMatch(/WARNING: app_settings has no row/);

    await db.sql`DELETE FROM "user" WHERE id = 'u_typo'`;
    await runMigrate(db.url, { settings: TENANT_SETTINGS });
    const users = await db.sql`
      SELECT u.id, u.is_platform_admin, m.role FROM "user" u JOIN member m ON m.user_id = u.id
      ORDER BY u.id`;
    expect(users).toEqual([
      { id: 'u_empty', is_platform_admin: false, role: 'member' },
      { id: 'u_multi', is_platform_admin: true, role: 'admin,superadmin' },
    ]);
    const post = await verifyMultitenant(db.url);
    expect(post.problems).toEqual([`organization: 1 without app_settings (${SLUG})`]);
    expect(post.notes).toContain('platform admins: 1');
    await db.sql.end();
  });
});

describe('0001 platform admin promotion', () => {
  async function withExtraSuperadmin() {
    const db = await legacyDb({ withData: true });
    await db.sql`
      INSERT INTO "user" (id, name, email, role)
      VALUES ('u_staff_super', 's', 'staff-super@legacy.test', 'superadmin')`;
    return db;
  }

  const platformAdmins = (sql: postgres.Sql) =>
    sql<{ id: string }[]>`SELECT id FROM "user" WHERE is_platform_admin ORDER BY id`.then((r) =>
      r.map((u) => u.id),
    );

  it('without a list promotes every superadmin and pre-verify says so', async () => {
    const db = await withExtraSuperadmin();
    const pre = await verifyMultitenant(db.url, { pre: true });
    expect(pre.problems).toEqual([]);
    expect(pre.notes).toContain('superadmins: staff-super@legacy.test, super@legacy.test');
    expect(pre.notes).toContain(
      'platform admins after 0001 (no list given, every superadmin): staff-super@legacy.test, super@legacy.test',
    );
    expect(pre.notes.join('\n')).toMatch(/--set mt\.platform_admin_emails=/);
    await runMigrate(db.url, { settings: TENANT_SETTINGS });
    expect(await platformAdmins(db.sql)).toEqual(['u_staff_super', 'usr_super']);
    await db.sql.end();
  });

  it('with a list promotes only the listed accounts, case-insensitively', async () => {
    const db = await withExtraSuperadmin();
    const list = 'SUPER@legacy.test, admin@Legacy.test';
    const pre = await verifyMultitenant(db.url, { pre: true, platformAdminEmails: list });
    expect(pre.problems).toEqual([]);
    expect(pre.notes).toContain(
      'platform admins after 0001 (from the list): admin@legacy.test, super@legacy.test',
    );
    await runMigrate(db.url, {
      settings: { ...TENANT_SETTINGS, 'mt.platform_admin_emails': list },
    });
    expect(await platformAdmins(db.sql)).toEqual(['usr_admin', 'usr_super']);
    expect((await verifyMultitenant(db.url)).problems).toEqual([]);
    await db.sql.end();
  });

  it('refuses a list with an unknown email and rolls back', async () => {
    const db = await withExtraSuperadmin();
    const list = 'super@legacy.test,ghost@legacy.test';
    const pre = await verifyMultitenant(db.url, { pre: true, platformAdminEmails: list });
    expect(pre.problems).toEqual([
      'platform admin list: ghost@legacy.test is not an existing user',
    ]);
    const before = await schemaDump(db.sql);
    await expectMigrationError(
      runMigrate(db.url, { settings: { ...TENANT_SETTINGS, 'mt.platform_admin_emails': list } }),
      /mt\.platform_admin_emails lists "ghost@legacy\.test"/,
    );
    expect(await schemaDump(db.sql)).toEqual(before);
    expect(await migrationRows(db.sql)).toHaveLength(1);
    await db.sql.end();
  });
});

describe('verifyMultitenant on corrupted data', () => {
  it('reports rows without tenant, users without membership and per-tenant duplicates', async () => {
    const db = await legacyDb({ withData: true });
    await runMigrate(db.url, { settings: TENANT_SETTINGS });
    expect((await verifyMultitenant(db.url)).problems).toEqual([]);
    const [org] = await db.sql<{ id: string }[]>`SELECT id FROM organization`;

    await db.sql`ALTER TABLE clients ALTER COLUMN tenant_id DROP NOT NULL`;
    await db.sql`INSERT INTO clients (name) VALUES ('orphan')`;
    await db.sql`INSERT INTO "user" (id, name, email) VALUES ('u_lost', 'l', 'lost@x.test')`;
    await db.sql`ALTER TABLE products DROP CONSTRAINT products_tenant_name_unique`;
    await db.sql`INSERT INTO products (tenant_id, name) VALUES (${org!.id}, 'Tacos')`;

    const { problems } = await verifyMultitenant(db.url);
    expect(problems).toEqual(
      expect.arrayContaining([
        'clients: 1 row(s) without tenant_id',
        'user: 1 without membership (lost@x.test)',
        'products: 1 duplicated value(s) of (tenant_id, name)',
      ]),
    );
    await db.sql.end();
  });
});

describe('0001 on a push-created database registered with db:baseline', () => {
  it('applies 0001 after markBaseline, like production', async () => {
    const db = await createDb();
    const ddl = readFileSync(join(MIGRATIONS_FOLDER, '0000_baseline.sql'), 'utf8');
    await db.sql.unsafe(ddl.replaceAll('--> statement-breakpoint', ''));
    await loadLegacyData(db.sql);
    await markBaseline(db.url);
    await runMigrate(db.url, { settings: TENANT_SETTINGS });
    expect(await db.sql`SELECT slug FROM organization`).toEqual([{ slug: SLUG }]);
    expect(await migrationRows(db.sql)).toHaveLength(2);
    expect((await verifyMultitenant(db.url)).problems).toEqual([]);
    await db.sql.end();
  });
});

describe('0001 on an empty legacy database', () => {
  it('applies without parameters and creates no organization', async () => {
    const db = await legacyDb({ withData: false });
    await runMigrate(db.url);
    const [orgs] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM organization`;
    expect(orgs!.n).toBe(0);
    expect(await migrationRows(db.sql)).toHaveLength(2);
    expect((await verifyMultitenant(db.url)).problems).toEqual([]);
    await db.sql.end();
  });

  it('builds the same schema as drizzle-kit push of the TS schema', async () => {
    const migrated = await createDb();
    await runMigrate(migrated.url);
    const pushed = await createDb();
    const result = spawnSync('pnpm', ['exec', 'drizzle-kit', 'push', '--force'], {
      cwd: API_ROOT,
      env: { ...process.env, DATABASE_URL: pushed.url },
      encoding: 'utf8',
    });
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const a = await schemaDump(migrated.sql);
    const b = await schemaDump(pushed.sql);
    expect(a.columns.length).toBeGreaterThan(300);
    expect(a.constraints.length).toBeGreaterThan(100);
    expect(a.indexes.length).toBeGreaterThan(50);
    expect(a.enums).toEqual(b.enums);
    expect(a.columns).toEqual(b.columns);
    expect(a.constraints).toEqual(b.constraints);
    expect(a.indexes).toEqual(b.indexes);
    await migrated.sql.end();
    await pushed.sql.end();
  });
});
