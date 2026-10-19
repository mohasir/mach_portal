import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { MIGRATIONS_FOLDER } from './migrate';

type Journal = { entries: { tag: string; when: number }[] };
type Snapshot = { tables: Record<string, unknown> };

/**
 * Registers migration 0000 as already applied on databases that were created with
 * `drizzle-kit push`, so the migrator skips it instead of recreating existing tables.
 */
export async function markBaseline(url: string, migrationsFolder = MIGRATIONS_FOLDER) {
  const journal: Journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf8'),
  );
  const baseline = journal.entries[0];
  if (!baseline) throw new Error('Journal has no baseline entry');

  const snapshot: Snapshot = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta/0000_snapshot.json'), 'utf8'),
  );
  const expectedTables = Object.keys(snapshot.tables).map((key) => key.split('.')[1]!);
  const hash = createHash('sha256')
    .update(readFileSync(join(migrationsFolder, `${baseline.tag}.sql`), 'utf8'))
    .digest('hex');

  const sql = postgres(url, { max: 1 });
  try {
    const existing = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`;
    const present = new Set(existing.map((row) => row.table_name));
    const missing = expectedTables.filter((table) => !present.has(table));
    if (missing.length > 0) {
      throw new Error(
        `Database does not contain the baseline tables (missing: ${missing.join(', ')})`,
      );
    }

    await sql.begin(async (tx) => {
      await tx.unsafe('CREATE SCHEMA IF NOT EXISTS drizzle');
      await tx.unsafe(
        `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
           id SERIAL PRIMARY KEY,
           hash text NOT NULL,
           created_at bigint
         )`,
      );
      const [row] = await tx<
        { n: number }[]
      >`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
      if (row && row.n > 0)
        throw new Error('Migrations table already has rows; the baseline is already registered');
      await tx`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${baseline.when})`;
    });
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  markBaseline(url).then(
    () => {
      console.log('Baseline 0000 registered.');
      process.exit(0);
    },
    (error) => {
      console.error('Refused:', error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
