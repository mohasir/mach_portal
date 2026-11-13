export type ParsedArgs = { kind: 'help' } | { kind: 'all' } | { kind: 'run'; tenantSlug: string };

export const USAGE = `Usage: pnpm --filter api jobs:event-reminders -- (--tenant=<slug> | --all)

Runs the event selections reminder job, one transaction per organization.

Options:
  --tenant=<slug>  Slug of the organization to run the job for.
  --all            Run it for every organization; the others still run when one fails.
  --help           Show this message.`;

export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.includes('--help')) return { kind: 'help' };
  const all = argv.includes('--all');
  const flag = argv.find((arg) => arg.startsWith('--tenant='));
  const tenantSlug = flag?.slice('--tenant='.length).trim();
  if (all && flag !== undefined) {
    throw new Error('Pass either --tenant=<slug> or --all, not both.');
  }
  if (all) return { kind: 'all' };
  if (!tenantSlug) throw new Error('Missing required argument: either --tenant=<slug> or --all.');
  return { kind: 'run', tenantSlug };
}
