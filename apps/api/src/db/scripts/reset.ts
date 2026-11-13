import 'dotenv/config';
import postgres from 'postgres';
import { requireDatabaseUrl } from '../databaseUrls';

/**
 * Resets the database to a clean state: drops the `public` schema (every table) and drizzle's
 * internal `drizzle` schema. Meant for the `db:fresh` flow (reset → roles → migrate → seed).
 * NEVER use it in production.
 *
 * Recreating `public` drops the grants and default privileges of the `app` and `platform` roles,
 * which is why `db:fresh` runs `db:roles` again before migrating.
 */
async function reset() {
  let url: string;
  try {
    url = requireDatabaseUrl('DATABASE_OWNER_URL');
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });

  try {
    console.log('⚠️  Reseteando base de datos...');
    await sql.unsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await sql.unsafe('CREATE SCHEMA public');
    await sql.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE');
    console.log('✅ Base reseteada (estado limpio).');
  } catch (error) {
    console.error('❌ Error durante el reset:', error);
    await sql.end();
    process.exit(1);
  }

  await sql.end();
  process.exit(0);
}

reset();
