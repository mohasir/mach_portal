import { queryClient } from '../index';
import { DEMO_PLATFORM_ADMIN_EMAIL, DEMO_SHARED_USER_EMAIL, DEMO_TENANTS } from './demo';
import { PROD_SUPERADMIN_EMAIL } from './prod';
import { runSeed } from './run';

type DemoMode = 'prod' | 'local';

const demoUsersHelp = DEMO_TENANTS.map(
  (t) =>
    `  ${t.slug} ("${t.name}"):\n` +
    t.users.map((u) => `    ${u.email.padEnd(26)} ${u.role}`).join('\n') +
    `\n    ${DEMO_SHARED_USER_EMAIL.padEnd(26)} ${t.sharedUserRole} (shared account)`,
).join('\n');

const HELP = `Usage: pnpm db:seed --demo=<prod|local> [--tenant=<slug>]

Flags:
  --demo=prod --tenant=<slug>   Seed the global quote stages and the per-tenant defaults
                                (config, event types, reschedule reasons, base catalog, quote
                                PDF template) into an EXISTING tenant. Creates no accounts and no
                                memberships; if ${PROD_SUPERADMIN_EMAIL} exists it is only
                                marked as platform admin. --tenant is required.
  --demo=local                  Create the demo tenants below with complete demo data.
                                Refused when NODE_ENV=production, or when the database already
                                has tenants other than the demo ones.
  --demo=local --tenant=<slug>  Seed the full demo data set into an existing tenant
                                (users get emails <role>@<slug>.demo). Adds accounts with known
                                passwords to that tenant (a warning is printed); refused when
                                NODE_ENV=production.
  --help                        Show this help.

All runs are idempotent. Demo passwords come from SEED_PASSWORD (or the built-in default).

Demo users (--demo=local):
${demoUsersHelp}
  ${DEMO_PLATFORM_ADMIN_EMAIL.padEnd(28)} platform admin (isPlatformAdmin, no membership)
`;

function flagValue(name: string): string | undefined {
  const flag = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!flag) return undefined;
  return flag.includes('=') ? flag.split('=')[1] : process.argv[process.argv.indexOf(flag) + 1];
}

function parseArgs(): { demo: DemoMode; tenant?: string } {
  const demo = flagValue('demo');
  if (demo !== 'prod' && demo !== 'local') {
    throw new Error(
      `Missing or invalid --demo=<prod|local> (got: ${demo ?? 'nothing'}). Run with --help.`,
    );
  }
  const tenant = flagValue('tenant');
  if (demo === 'prod' && !tenant) {
    throw new Error('--demo=prod requires --tenant=<slug>. Run with --help.');
  }
  return { demo, tenant };
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(HELP);
    await queryClient.end();
    return;
  }

  try {
    const { demo, tenant } = parseArgs();
    console.log(`🌱 Iniciando seeding (--demo=${demo}${tenant ? ` --tenant=${tenant}` : ''})...`);
    await runSeed({ demo, tenant });
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
