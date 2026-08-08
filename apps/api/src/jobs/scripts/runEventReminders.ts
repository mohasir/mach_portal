import { queryClient } from '../../db';
import { checkEventSelectionsReminders } from '../eventReminders.job';

async function run() {
  console.log('Corriendo checkEventSelectionsReminders()...');
  await checkEventSelectionsReminders();
  console.log('Listo.');
}

run()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exitCode = 1;
  })
  .finally(() => queryClient.end());
