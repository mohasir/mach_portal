import { queryClient } from '../index';
import { seedUsers } from './users';
import { seedClients } from './clients';
import { seedStaff } from './staff';

async function main() {
  console.log('🌱 Iniciando seeding...');

  try {
    await seedUsers();
    await seedClients();
    await seedStaff();
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
