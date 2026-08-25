import postgres from 'postgres';
import { env } from '../../env';

/**
 * Resetea la base a un estado limpio: dropea el schema `public` (todas las tablas)
 * y el schema interno `drizzle`. Pensado para el flujo `db:fresh` (reset → push → seed).
 * NO usar en producción.
 */
async function reset() {
  const sql = postgres(env.DATABASE_URL, { max: 1 });

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
