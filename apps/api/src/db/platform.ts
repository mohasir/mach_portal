import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { requireDatabaseUrl } from './databaseUrls';
import * as schema from './schema';
import type { Database } from './index';

let client: postgres.Sql | undefined;
let database: Database | undefined;

// Created on first use: the API never connects as `platform`, so importing this module must not
// require DATABASE_PLATFORM_URL. Only scripts that cross organizations call it.
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
