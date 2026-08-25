import { queryClient } from '../index';
import { seedAdminUsers, seedDemoUsers } from './users';
import { seedClients } from './clients';
import { seedStaff } from './staff';
import { seedCatalog } from './catalog';
import { seedEventTypes } from './eventTypes';
import { seedConfig } from './config';
import { seedQuoteStages } from './quoteStages';
import { seedQuotePdfTemplate } from './quotePdfTemplate';
import { seedQuotes } from './quotes';
import { seedEvents } from './events';
import { seedEventPayments } from './eventPayments';

type DemoMode = 'prod' | 'local';

function parseDemoMode(): DemoMode {
  const flag = process.argv.find((a) => a === '--demo' || a.startsWith('--demo='));
  const raw = flag ? (flag.split('=')[1] ?? process.argv[process.argv.indexOf(flag) + 1]) : undefined;

  if (raw !== 'prod' && raw !== 'local') {
    throw new Error(
      `Falta o es inválido --demo=<prod|local> (recibido: ${raw ?? 'nada'}). ` +
        'Ejemplo: pnpm db:seed --demo=local',
    );
  }
  return raw;
}

async function main() {
  const demoMode = parseDemoMode();
  console.log(`🌱 Iniciando seeding (--demo=${demoMode})...`);

  try {
    // Datos base — siempre se siembran, tanto en prod como en local.
    await seedAdminUsers();
    await seedCatalog();
    await seedEventTypes();
    await seedConfig();
    await seedQuoteStages();
    await seedQuotePdfTemplate();

    if (demoMode === 'local') {
      await seedDemoUsers();
      await seedClients();
      await seedStaff();
      await seedQuotes();
      await seedEvents();
      await seedEventPayments();
    }

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
