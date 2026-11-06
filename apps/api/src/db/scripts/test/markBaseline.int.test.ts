import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { markBaseline } from '../markBaseline';
import { MIGRATIONS_FOLDER, parseSetArgs, runMigrate } from '../migrate';

const serverUrl = process.env['TEST_DATABASE_URL'];
if (!serverUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const withDatabase = (name: string) => {
  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  return url.toString();
};

const BASELINE_TABLES = 30;
const created: string[] = [];
const tmpDirs: string[] = [];
let admin: postgres.Sql;
// Only the 0000 entry of the real journal, so these assertions hold whatever comes after it.
let baselineOnly: string;

async function createDb(): Promise<{ url: string; sql: postgres.Sql }> {
  const name = `mt_baseline_test_${randomBytes(6).toString('hex')}`;
  await admin.unsafe(`CREATE DATABASE ${name}`);
  created.push(name);
  const url = withDatabase(name);
  return { url, sql: postgres(url, { max: 1 }) };
}

async function publicTableCount(sql: postgres.Sql) {
  const [row] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
  return row!.n;
}

function writeMigrationsFolder(entries: { tag: string; when: number; sql: string }[]) {
  const dir = mkdtempSync(join(tmpdir(), 'mt-migrations-'));
  tmpDirs.push(dir);
  mkdirSync(join(dir, 'meta'));
  writeFileSync(
    join(dir, 'meta/_journal.json'),
    JSON.stringify({
      version: '7',
      dialect: 'postgresql',
      entries: entries.map((e, idx) => ({
        idx,
        version: '7',
        when: e.when,
        tag: e.tag,
        breakpoints: true,
      })),
    }),
  );
  for (const e of entries) writeFileSync(join(dir, `${e.tag}.sql`), e.sql);
  return dir;
}

beforeAll(() => {
  admin = postgres(serverUrl, { max: 1 });
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, 'meta/_journal.json'), 'utf8'));
  const first = journal.entries[0];
  baselineOnly = writeMigrationsFolder([
    {
      tag: first.tag,
      when: first.when,
      sql: readFileSync(join(MIGRATIONS_FOLDER, `${first.tag}.sql`), 'utf8'),
    },
  ]);
});

afterAll(async () => {
  for (const name of created) await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.end();
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

describe('migrate on an empty database', () => {
  it('creates the full baseline schema and records it', async () => {
    const { url, sql } = await createDb();
    await runMigrate(url, { migrationsFolder: baselineOnly });
    expect(await publicTableCount(sql)).toBe(BASELINE_TABLES);
    const rows = await sql`SELECT hash FROM drizzle.__drizzle_migrations`;
    expect(rows).toHaveLength(1);
    await sql.end();
  });
});

describe('markBaseline', () => {
  it('registers 0000 on a push-created database, keeping data and skipping DDL on migrate', async () => {
    const { url, sql } = await createDb();
    await runMigrate(url, { migrationsFolder: baselineOnly });
    await sql`INSERT INTO reschedule_reasons (name) VALUES ('keep me')`;
    await sql.unsafe('DROP SCHEMA drizzle CASCADE');

    await markBaseline(url);
    await runMigrate(url, { migrationsFolder: baselineOnly });

    expect(await sql`SELECT name FROM reschedule_reasons`).toEqual([{ name: 'keep me' }]);
    expect(await sql`SELECT id FROM drizzle.__drizzle_migrations`).toHaveLength(1);
    await sql.end();
  });

  it('records the same hash and created_at that migrate would', async () => {
    const a = await createDb();
    const b = await createDb();
    await runMigrate(a.url, { migrationsFolder: baselineOnly });
    await b.sql.unsafe(baselineDdl());
    await markBaseline(b.url);
    const read = (sql: postgres.Sql) =>
      sql`SELECT hash, created_at::text AS created_at FROM drizzle.__drizzle_migrations`;
    expect(await read(b.sql)).toEqual(await read(a.sql));
    await a.sql.end();
    await b.sql.end();
  });

  it('refuses an empty database', async () => {
    const { url, sql } = await createDb();
    await expect(markBaseline(url)).rejects.toThrow(/baseline tables/i);
    await sql.end();
  });

  it('refuses a database that is already marked', async () => {
    const { url, sql } = await createDb();
    await runMigrate(url, { migrationsFolder: baselineOnly });
    await expect(markBaseline(url)).rejects.toThrow(/already/i);
    expect(await sql`SELECT id FROM drizzle.__drizzle_migrations`).toHaveLength(1);
    await sql.end();
  });
});

describe('migrate transactionality and settings', () => {
  it('applies all pending migrations in one transaction', async () => {
    const { url, sql } = await createDb();
    const dir = writeMigrationsFolder([
      { tag: '0000_first', when: 1_000, sql: 'CREATE TABLE first_ok (id int);' },
      {
        tag: '0001_second',
        when: 2_000,
        sql: 'CREATE TABLE second_bad (id int);--> statement-breakpoint\nSELECT 1/0;',
      },
    ]);
    await expect(runMigrate(url, { migrationsFolder: dir })).rejects.toThrow();
    const [row] = await sql`SELECT to_regclass('public.first_ok') AS t`;
    expect(row!['t']).toBeNull();
    await sql.end();
  });

  it('passes --set values as connection settings readable via current_setting', async () => {
    const { url, sql } = await createDb();
    const dir = writeMigrationsFolder([
      {
        tag: '0000_settings',
        when: 1_000,
        sql: "CREATE TABLE seeded AS SELECT current_setting('mt.value') AS v;",
      },
    ]);
    await runMigrate(url, { migrationsFolder: dir, settings: { 'mt.value': 'hello' } });
    expect(await sql`SELECT v FROM seeded`).toEqual([{ v: 'hello' }]);
    await sql.end();
  });

  it('parses repeatable --set key=value arguments', () => {
    expect(parseSetArgs(['--set', 'a.b=1', '--set', 'c.d=x=y'])).toEqual({
      'a.b': '1',
      'c.d': 'x=y',
    });
    expect(() => parseSetArgs(['--set', 'novalue'])).toThrow();
  });
});

function baselineDdl() {
  const file = fileURLToPath(new URL('../../../../drizzle/0000_baseline.sql', import.meta.url));
  return readFileSync(file, 'utf8').replaceAll('--> statement-breakpoint', '');
}
