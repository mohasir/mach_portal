import 'dotenv/config';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url));

export type MigrateOptions = {
  migrationsFolder?: string;
  settings?: Record<string, string>;
};

export function parseSetArgs(args: string[]): Record<string, string> {
  const settings: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--set') continue;
    const pair = args[++i] ?? '';
    const eq = pair.indexOf('=');
    if (eq <= 0) throw new Error(`Invalid --set argument "${pair}", expected key=value`);
    settings[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return settings;
}

// The server splits the `options` startup parameter on whitespace; a backslash escapes the
// next character, so values such as a tenant name with spaces survive intact.
export function escapeOption(value: string): string {
  return value.replace(/[\\\s]/g, (char) => `\\${char}`);
}

export async function runMigrate(url: string, options: MigrateOptions = {}) {
  const { migrationsFolder = MIGRATIONS_FOLDER, settings = {} } = options;
  // Startup parameters make the values visible to migration SQL via current_setting().
  const connection = Object.entries(settings)
    .map(([key, value]) => `-c ${escapeOption(`${key}=${value}`)}`)
    .join(' ');
  const sql = postgres(url, { max: 1, ...(connection && { connection: { options: connection } }) });
  try {
    await migrate(drizzle(sql), { migrationsFolder });
  } finally {
    await sql.end();
  }
}

async function main() {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is required');
  await runMigrate(url, { settings: parseSetArgs(process.argv.slice(2)) });
  console.log('Migrations applied.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    () => process.exit(0),
    (error) => {
      // Drizzle wraps the database error in a message that repeats the whole statement, which
      // can be a long DO block; the reason (e.g. a RAISE EXCEPTION text) is in the cause.
      const cause = error instanceof Error && error.cause instanceof Error ? error.cause : undefined;
      console.error(`Migration failed: ${cause?.message ?? (error instanceof Error ? error.message : error)}`);
      console.error('Nothing was applied: all pending migrations run in one transaction.');
      if (cause && error instanceof Error) console.error(`\n${error.message.slice(0, 400)}…`);
      process.exit(1);
    },
  );
}
