import { queryClient } from '../index';
import { seedUsers } from './users';

async function main() {
  console.log('🌱 Iniciando seeding...');

  try {
    await seedUsers();
    console.log('✅ Seeding completado.');
  } catch (error) {
    console.error('❌ Seeding falló:', error);
    await queryClient.end();
    process.exit(1);
  }

  await queryClient.end();
  process.exit(0);
}

main();
