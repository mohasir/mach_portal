import { queryClient } from '../../db';
import { TenancyRepository } from '../../lib/tenancy/tenancy.repository';
import { checkEventSelectionsReminders } from '../eventReminders.job';
import { parseArgs, USAGE } from './args';

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.kind === 'help') {
    console.log(USAGE);
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
