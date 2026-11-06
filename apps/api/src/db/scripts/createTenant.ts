import { TRPCError } from '@trpc/server';
import { queryClient } from '../index';
import { createTenant } from '../../lib/tenancy/createTenant';
import { AppError, ErrorCodes } from '../../lib/errors';
import type { CreateTenantInput } from '../../lib/tenancy/createTenant';

const HELP = `Usage: pnpm tenant:create --slug=<slug> --name=<name> --admin-email=<email> --admin-name=<name>

Creates an organization (tenant), seeds its defaults (config, event types, reschedule reasons,
base catalog, quote PDF template) and adds the first admin as a member with role "admin".

Flags:
  --slug=<slug>          Stable identifier: lowercase letters, digits and "-", 3 to 32 chars
                         (uppercase input is lowercased). Must be unique.
  --name=<name>          Display name of the organization.
  --admin-email=<email>  First admin. A new account gets a one-time password setup link
                         (printed below); an existing account is attached as admin and keeps
                         its current password (no link).
  --admin-name=<name>    Name for a new admin account.
  --help                 Show this help.

The global quote stages must already exist (pnpm db:seed seeds them).`;

function flag(name: string): string | undefined {
  const arg = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!arg) return undefined;
  return arg.includes('=')
    ? arg.slice(arg.indexOf('=') + 1)
    : process.argv[process.argv.indexOf(arg) + 1];
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log(HELP);
    return 0;
  }

  const slug = flag('slug');
  const name = flag('name');
  const adminEmail = flag('admin-email');
  const adminName = flag('admin-name');
  if (!slug || !name || !adminEmail || !adminName) {
    const missing = [
      ['--slug', slug],
      ['--name', name],
      ['--admin-email', adminEmail],
      ['--admin-name', adminName],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k);
    console.error(`Missing required flags: ${missing.join(', ')}. Run with --help.`);
    return 1;
  }
  const input: CreateTenantInput = { slug, name, adminEmail, adminName };

  try {
    const { tenantId, setupUrl } = await createTenant(input);
    console.log(`Tenant created: ${tenantId}`);
    console.log(
      setupUrl
        ? `Password setup link for ${adminEmail} (valid 24 h): ${setupUrl}`
        : `${adminEmail} already had an account: attached as admin, password unchanged.`,
    );
    return 0;
  } catch (error) {
    const code =
      error instanceof TRPCError && error.cause instanceof AppError ? error.cause.code : null;
    const messages: Record<string, string> = {
      [ErrorCodes.tenant.INVALID_SLUG]:
        'Invalid --slug: use 3-32 lowercase letters, digits or "-", not starting or ending with "-".',
      [ErrorCodes.tenant.INVALID_INPUT]: 'Invalid --name, --admin-name or --admin-email.',
      [ErrorCodes.tenant.SLUG_TAKEN]:
        `A tenant with slug "${slug.trim().toLowerCase()}" already exists.`,
    };
    console.error(code && messages[code] ? messages[code] : error);
    return 1;
  }
}

main().then(async (status) => {
  await queryClient.end();
  process.exit(status);
});
