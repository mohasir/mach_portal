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

export async function runMigrate(url: string, options: MigrateOptions = {}) {
  const { migrationsFolder = MIGRATIONS_FOLDER, settings = {} } = options;
  // Startup parameters make the values visible to migration SQL via current_setting().
  const connection = Object.entries(settings)
    .map(([key, value]) => `-c ${key}=${value}`)
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
      console.error('Migration failed:', error);
      process.exit(1);
    },
  );
}
