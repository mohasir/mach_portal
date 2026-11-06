export type ParsedArgs = { kind: 'help' } | { kind: 'run'; tenantSlug: string };

export const USAGE = `Usage: pnpm --filter api jobs:event-reminders -- --tenant=<slug>

Runs the event selections reminder job for a single tenant.

Options:
  --tenant=<slug>  Slug of the organization to run the job for (required).
  --help           Show this message.`;

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes('--help')) return { kind: 'help' };
  const flag = argv.find((arg) => arg.startsWith('--tenant='));
  const tenantSlug = flag?.slice('--tenant='.length).trim();
  if (!tenantSlug) throw new Error('Missing required argument --tenant=<slug>.');
  return { kind: 'run', tenantSlug };
}
