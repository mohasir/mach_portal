import { spawnSync } from 'node:child_process';
import postgres from 'postgres';
import { ensureRoles } from '../db/rls/roles';
import { assertSafeTestDatabaseUrl } from './dbGuard';
import { completePushedPolicies } from './rlsPolicies';
import {
  TEST_APP_PASSWORD,
  TEST_APP_ROLE,
  TEST_PLATFORM_PASSWORD,
  TEST_PLATFORM_ROLE,
} from './roles';

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
    env: { ...process.env, DATABASE_OWNER_URL: url },
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`drizzle-kit push failed:\n${result.stdout}\n${result.stderr}`);
  }

  // After the push, so the grants cover the tables it just created.
  const admin = postgres(url!, { max: 1, onnotice: () => {} });
  try {
    await completePushedPolicies(admin);
    const [row] = await admin<{ owner: string }[]>`SELECT current_user AS owner`;
    await ensureRoles(admin, {
      appRole: TEST_APP_ROLE,
      appPassword: TEST_APP_PASSWORD,
      platformRole: TEST_PLATFORM_ROLE,
      platformPassword: TEST_PLATFORM_PASSWORD,
      ownerRole: row!.owner,
    });
  } finally {
    await admin.end();
  }
}
