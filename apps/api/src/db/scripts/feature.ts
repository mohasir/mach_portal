import { userInfo } from 'node:os';
import { pathToFileURL } from 'node:url';
import { TRPCError } from '@trpc/server';
import { AppError } from '../../lib/errors';
import { BILLING_PERIODS, listFeatures, setFeature, unsetFeature } from '../../lib/features/admin';
import { closePlatformDb, platformDb } from '../platform';

const COMMANDS = ['list', 'set', 'unset'] as const;
type Command = (typeof COMMANDS)[number];

const HELP = `Usage:
  pnpm --filter api feature:list  --tenant <slug>
  pnpm --filter api feature:set   --tenant <slug> --key <key> [--expires YYYY-MM-DD] [--price <cents>] [--period monthly|yearly] [--currency <ISO>]
  (set: --expires never and --price|--period|--currency none clear the stored value)
  pnpm --filter api feature:unset --tenant <slug> --key <key>

Flags:
  --tenant <slug>     Organization slug (required).
  --key <key>         Feature key (set and unset). Core features cannot be toggled.
  --expires <date>    Last active day, YYYY-MM-DD (set only). Stored as the start of the next day, UTC.
                      "never" makes it permanent (clears the expiry).
  --price <cents>     Agreed price in integer cents, 0 or more (set only). Informative: nothing charges it.
                      "none" clears it.
  --period <period>   Billing period: ${BILLING_PERIODS.join(' or ')} (set only; "none" clears it).
  --currency <ISO>    3-letter ISO currency code, e.g. USD (set only; "none" clears it).

Connects with DATABASE_PLATFORM_URL (the "platform" role), the only role that can write features.`;

export class FeatureUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeatureUsageError';
  }
}

export type FeatureArgs = {
  command: Command;
  tenantSlug: string;
  key?: string;
  // Absent keeps the stored value; null clears it.
  expires?: Date | null;
  price?: number | null;
  period?: string | null;
  currency?: string | null;
};

const CLEAR = 'none';
const NEVER = 'never';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// `--expires` names the last active day; the stored instant is the start of the following day,
// which is when the feature stops resolving as active.
export function parseExpiryDate(value: string): Date {
  const match = DATE_PATTERN.exec(value);
  const invalid = () =>
    new FeatureUsageError(`Invalid --expires "${value}": use a real date as YYYY-MM-DD.`);
  if (!match) throw invalid();
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const lastDay = new Date(Date.UTC(year, month - 1, day));
  if (
    lastDay.getUTCFullYear() !== year ||
    lastDay.getUTCMonth() !== month - 1 ||
    lastDay.getUTCDate() !== day
  ) {
    throw invalid();
  }
  return new Date(Date.UTC(year, month - 1, day + 1));
}

const FLAGS_BY_COMMAND: Record<Command, readonly string[]> = {
  list: ['tenant'],
  set: ['tenant', 'key', 'expires', 'price', 'period', 'currency'],
  unset: ['tenant', 'key'],
};
const ALL_FLAGS = FLAGS_BY_COMMAND.set;

function readFlags(tokens: string[]): Map<string, string> {
  const flags = new Map<string, string>();
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (!token.startsWith('--')) throw new FeatureUsageError(`Unexpected argument "${token}".`);
    const eq = token.indexOf('=');
    const name = eq === -1 ? token.slice(2) : token.slice(2, eq);
    if (!ALL_FLAGS.includes(name)) throw new FeatureUsageError(`Unknown flag --${name}.`);
    if (flags.has(name)) throw new FeatureUsageError(`Flag --${name} given more than once.`);
    let value: string | undefined;
    if (eq !== -1) {
      value = token.slice(eq + 1);
    } else if (tokens[i + 1] !== undefined && !tokens[i + 1]!.startsWith('--')) {
      value = tokens[++i];
    }
    if (value === undefined || value.trim() === '') {
      throw new FeatureUsageError(`Flag --${name} needs a value.`);
    }
    flags.set(name, value.trim());
  }
  return flags;
}

export function parseFeatureArgs(argv: string[]): FeatureArgs {
  // pnpm may forward a literal `--` before the flags.
  const [command, ...rest] = argv.filter((a) => a !== '--');
  if (!command || !(COMMANDS as readonly string[]).includes(command)) {
    throw new FeatureUsageError(
      `Missing or unknown command "${command ?? ''}": use ${COMMANDS.join(', ')}.`,
    );
  }
  const cmd = command as Command;
  const flags = readFlags(rest);

  for (const name of flags.keys()) {
    if (!FLAGS_BY_COMMAND[cmd].includes(name)) {
      throw new FeatureUsageError(`Flag --${name} does not apply to "${cmd}".`);
    }
  }
  const tenantSlug = flags.get('tenant');
  if (!tenantSlug) throw new FeatureUsageError('Missing required flag --tenant.');
  const key = flags.get('key');
  if (cmd !== 'list' && !key) throw new FeatureUsageError('Missing required flag --key.');

  const args: FeatureArgs = { command: cmd, tenantSlug };
  if (key) args.key = key;

  const expires = flags.get('expires');
  if (expires) args.expires = expires === NEVER ? null : parseExpiryDate(expires);

  const price = flags.get('price');
  if (price === CLEAR) {
    args.price = null;
  } else if (price !== undefined) {
    if (
      !/^\d+$/.test(price) ||
      !Number.isSafeInteger(Number(price)) ||
      Number(price) > 2_147_483_647
    ) {
      throw new FeatureUsageError(`Invalid --price "${price}": use integer cents, 0 or more.`);
    }
    args.price = Number(price);
  }

  const period = flags.get('period');
  if (period === CLEAR) {
    args.period = null;
  } else if (period !== undefined) {
    if (!(BILLING_PERIODS as readonly string[]).includes(period)) {
      throw new FeatureUsageError(
        `Invalid --period "${period}": use ${BILLING_PERIODS.join(' or ')}.`,
      );
    }
    args.period = period;
  }

  const currency = flags.get('currency');
  if (currency === CLEAR) {
    args.currency = null;
  } else if (currency !== undefined) {
    if (!/^[A-Za-z]{3}$/.test(currency)) {
      throw new FeatureUsageError(
        `Invalid --currency "${currency}": use a 3-letter ISO code such as USD.`,
      );
    }
    args.currency = currency.toUpperCase();
  }
  return args;
}

const iso = (date: Date | null) => (date ? date.toISOString() : '-');

function printTable(rows: Awaited<ReturnType<typeof listFeatures>>) {
  if (rows.length === 0) {
    console.log('No feature rows: only core features are active.');
    return;
  }
  const header = ['key', 'kind', 'enabled', 'active', 'expires_at', 'price', 'period'];
  const body = rows.map((r) => [
    r.featureKey,
    r.kind,
    String(r.enabled),
    String(r.active),
    iso(r.expiresAt),
    r.priceCents === null ? '-' : `${r.priceCents}${r.currency ? ` ${r.currency}` : ''}`,
    r.billingPeriod ?? '-',
  ]);
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((row) => row[i]!.length)));
  for (const line of [header, ...body]) {
    console.log(
      line
        .map((cell, i) => cell.padEnd(widths[i]!))
        .join('  ')
        .trimEnd(),
    );
  }
}

async function main(argv: string[]): Promise<number> {
  if (argv.includes('--help')) {
    console.log(HELP);
    return 0;
  }
  // Loaded here so importing this module (tests) does not read the environment.
  await import('dotenv/config');

  let args: FeatureArgs;
  try {
    args = parseFeatureArgs(argv);
  } catch (error) {
    if (error instanceof FeatureUsageError) {
      console.error(`${error.message}\n\n${HELP}`);
      return 1;
    }
    throw error;
  }

  const database = platformDb();
  const actor = userInfo().username;
  try {
    if (args.command === 'list') {
      printTable(await listFeatures(database, args.tenantSlug));
    } else if (args.command === 'set') {
      const row = await setFeature(database, {
        tenantSlug: args.tenantSlug,
        key: args.key!,
        expiresAt: args.expires,
        priceCents: args.price,
        billingPeriod: args.period,
        currency: args.currency,
        actor,
      });
      console.log(
        `Enabled "${row.featureKey}" for ${args.tenantSlug} (expires ${iso(row.expiresAt)}).`,
      );
    } else {
      const row = await unsetFeature(database, {
        tenantSlug: args.tenantSlug,
        key: args.key!,
        actor,
      });
      console.log(`Disabled "${row.featureKey}" for ${args.tenantSlug}.`);
    }
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
