import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { requireDatabaseUrl } from './databaseUrls';
import * as schema from './schema';
import type { Database } from './index';

let client: postgres.Sql | undefined;
let database: Database | undefined;

// Created lazily so that importing this module does not require DATABASE_PLATFORM_URL. The API
// runtime does need the variable once a console request arrives: without it those requests fail
// closed instead of falling back to the app role.
export function platformDb(): Database {
  if (!database) {
    client = postgres(requireDatabaseUrl('DATABASE_PLATFORM_URL'), { max: 4, onnotice: () => {} });
    database = drizzle(client, { schema });
  }
  return database;
}

export async function closePlatformDb(): Promise<void> {
  const open = client;
  client = undefined;
  database = undefined;
  await open?.end();
}
