import { pathToFileURL } from 'node:url';
import { ZodError } from 'zod';
import { requireDatabaseUrl } from '../databaseUrls';
import { readRoleCredentials } from '../rls/roles';

type Source = Record<string, string | undefined>;

// Everything the steps of db:fresh need, checked without touching the database: the reset is
// destructive, so a missing variable must stop the flow before it, not after.
export function checkDatabaseUrls(source: Source): void {
  const ownerUrl = requireDatabaseUrl('DATABASE_OWNER_URL', source);
  const { appRole, platformRole } = readRoleCredentials(source);
  const owner = decodeURIComponent(new URL(ownerUrl).username);
  if (owner === appRole || owner === platformRole) {
    throw new Error(
      `DATABASE_OWNER_URL, DATABASE_APP_URL and DATABASE_PLATFORM_URL must name three different roles ` +
        `(the owner is "${owner}").`,
    );
  }
}

async function main() {
  await import('dotenv/config');
  try {
    checkDatabaseUrls(process.env);
    // The seed loads the whole API environment, so validate it here too.
    await import('../../env');
  } catch (error) {
    if (error instanceof ZodError) {
      const missing = error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
      console.error(`db:preflight failed: invalid environment variables\n${missing.join('\n')}`);
    } else {
      console.error(`db:preflight failed: ${error instanceof Error ? error.message : error}`);
    }
    process.exit(1);
  }
  console.log('db:preflight ok: environment is complete, safe to reset.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
