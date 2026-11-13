import { queryClient } from '../../db';
import { TenancyRepository } from '../../lib/tenancy/tenancy.repository';
import {
  checkEventSelectionsReminders,
  checkEventSelectionsRemindersForAllTenants,
} from '../eventReminders.job';
import { parseArgs, USAGE } from './args';

// Uses DATABASE_APP_URL (the `app` role): each organization's work runs in its own tenant transaction.
async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.kind === 'help') {
    console.log(USAGE);
    return;
  }

  if (args.kind === 'all') {
    console.log('Running checkEventSelectionsReminders() for every organization...');
    const { tenantIds, failed } = await checkEventSelectionsRemindersForAllTenants();
    console.log(`Done: ${tenantIds.length - failed.length} of ${tenantIds.length} organizations.`);
    if (failed.length > 0) {
      throw new Error(`Failed for: ${failed.map((f) => f.tenantId).join(', ')}`);
    }
    return;
  }

  const tenant = await new TenancyRepository().findBySlug(args.tenantSlug);
  if (!tenant) throw new Error(`Organization "${args.tenantSlug}" does not exist.`);

  console.log(`Running checkEventSelectionsReminders() for "${args.tenantSlug}"...`);
  await checkEventSelectionsReminders(tenant.id);
  console.log('Done.');
}

run()
  .catch((error) => {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => queryClient.end());
