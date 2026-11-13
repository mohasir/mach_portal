import { pathToFileURL } from 'node:url';
import postgres from 'postgres';
import { requireDatabaseUrl } from '../databaseUrls';
import { ensureRoles, readRoleCredentials } from '../rls/roles';

async function main() {
  // Loaded here rather than at module level so importing ensureRoles (test setup) leaves
  // process.env untouched.
  await import('dotenv/config');
  const url = requireDatabaseUrl('DATABASE_OWNER_URL');
  const credentials = readRoleCredentials(process.env);

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql<{ owner: string }[]>`SELECT current_user AS owner`;
    await ensureRoles(sql, { ...credentials, ownerRole: row!.owner });
    console.log(
      `Roles ready: "${credentials.appRole}" (restricted, subject to RLS) and ` +
        `"${credentials.platformRole}" (BYPASSRLS); ` +
        `default privileges set for objects created by "${row!.owner}".`,
    );
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(`db:roles failed: ${error instanceof Error ? error.message : error}`);
      process.exit(1);
    },
  );
}
