import { pathToFileURL } from 'node:url';
import { TRPCError } from '@trpc/server';
import { CATALOG_KINDS } from '@repo/schemas';
import { AppError } from '../../lib/errors';
import { setCatalogKind } from '../../lib/tenancy/profile';
import { closePlatformDb, platformDb } from '../platform';

const HELP = `Usage: pnpm --filter api tenant:set-catalog-kind --tenant <slug> --kind <${CATALOG_KINDS.join('|')}>

Sets what an organization sells, which words the web uses for its catalog items.

Flags:
  --tenant <slug>  Organization slug (required).
  --kind <kind>    ${CATALOG_KINDS.join(' or ')} (required).

Connects with DATABASE_PLATFORM_URL (the "platform" role), the only role that can write tenant_profile.`;

export class TenantProfileUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantProfileUsageError';
  }
}

export type CatalogKindArgs = { tenantSlug: string; kind: string };

const FLAGS = ['tenant', 'kind'];

export function parseCatalogKindArgs(argv: string[]): CatalogKindArgs {
  // pnpm may forward a literal `--` before the flags.
  const tokens = argv.filter((a) => a !== '--');
  const flags = new Map<string, string>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!token.startsWith('--'))
      throw new TenantProfileUsageError(`Unexpected argument "${token}".`);
    const eq = token.indexOf('=');
    const name = eq === -1 ? token.slice(2) : token.slice(2, eq);
    if (!FLAGS.includes(name)) throw new TenantProfileUsageError(`Unknown flag --${name}.`);
    if (flags.has(name)) throw new TenantProfileUsageError(`Flag --${name} given more than once.`);
    let value: string | undefined;
    if (eq !== -1) {
      value = token.slice(eq + 1);
    } else if (tokens[i + 1] !== undefined && !tokens[i + 1]!.startsWith('--')) {
      value = tokens[++i];
    }
    if (value === undefined || value.trim() === '') {
      throw new TenantProfileUsageError(`Flag --${name} needs a value.`);
    }
    flags.set(name, value.trim());
  }
  const tenantSlug = flags.get('tenant');
  if (!tenantSlug) throw new TenantProfileUsageError('Missing required flag --tenant.');
  const kind = flags.get('kind');
  if (!kind) throw new TenantProfileUsageError('Missing required flag --kind.');
  return { tenantSlug, kind };
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes('--help')) {
    console.log(HELP);
    return 0;
  }
  // Loaded here so importing this module (tests) does not read the environment.
  await import('dotenv/config');

  let args: CatalogKindArgs;
  try {
    args = parseCatalogKindArgs(argv);
  } catch (error) {
    if (error instanceof TenantProfileUsageError) {
      console.error(`${error.message}\n\n${HELP}`);
      return 1;
    }
    throw error;
  }

  try {
    await setCatalogKind(platformDb(), args);
    console.log(`Catalog kind of ${args.tenantSlug} set to "${args.kind}".`);
    return 0;
  } catch (error) {
    if (error instanceof TRPCError && error.cause instanceof AppError) {
      console.error(`${error.cause.code}: ${error.cause.message}`);
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    return 1;
  } finally {
    await closePlatformDb();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
