import { spawnSync } from 'node:child_process';
import postgres from 'postgres';
import { assertSafeTestDatabaseUrl } from './dbGuard';

export default async function setup() {
  const url = process.env['TEST_DATABASE_URL'];
  assertSafeTestDatabaseUrl(url);

  const sql = postgres(url!, { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE');
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await sql.unsafe('CREATE SCHEMA public');
  } finally {
    await sql.end();
  }

  const result = spawnSync('pnpm', ['exec', 'drizzle-kit', 'push', '--force'], {
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`drizzle-kit push failed:\n${result.stdout}\n${result.stderr}`);
  }
}
