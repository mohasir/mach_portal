import { TRPCError } from '@trpc/server';
import { CATALOG_KINDS } from '@repo/schemas';
import { authQueryClient, queryClient } from '../index';
import { closePlatformDb, platformDb } from '../platform';
import { createTenant } from '../../lib/tenancy/createTenant';
import { AppError, ErrorCodes } from '../../lib/errors';
import type { CreateTenantInput } from '../../lib/tenancy/createTenant';

const HELP = `Usage: pnpm tenant:create --slug=<slug> --name=<name> --admin-email=<email> --admin-name=<name> [--catalog-kind=<kind>]

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
  --catalog-kind=<kind>  What the organization sells: products (default) or services.
  --help                 Show this help.

The global quote stages must already exist (pnpm db:seed seeds them).
Connects with DATABASE_PLATFORM_URL (the "platform" role); the admin account goes through Better
Auth, which uses DATABASE_APP_URL.`;

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
  const catalogKind = flag('catalog-kind');
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
  const input: CreateTenantInput = {
    slug,
    name,
    adminEmail,
    adminName,
    ...(catalogKind !== undefined && { catalogKind }),
  };
  const database = platformDb();

  try {
    const { tenantId, setupUrl } = await createTenant(input, database);
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
      [ErrorCodes.tenant.UNKNOWN_CATALOG_KIND]:
        `Invalid --catalog-kind: use ${CATALOG_KINDS.join(' or ')}.`,
      [ErrorCodes.tenant.SLUG_TAKEN]:
        `A tenant with slug "${slug.trim().toLowerCase()}" already exists.`,
    };
    console.error(code && messages[code] ? messages[code] : error);
    return 1;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  })
  .then(async (status) => {
    await Promise.all([closePlatformDb(), queryClient.end(), authQueryClient.end()]);
    process.exit(status);
  });
