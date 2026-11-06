import { DEMO_TENANTS } from './demo';

export type DemoGuardInput = {
  env: string | undefined;
  organizations: string[];
  tenantFlag: string | undefined;
};

// The demo seed creates accounts with a known password (and a platform admin), so it must never
// reach a real database by accident.
export function assertDemoAllowed({ env, organizations, tenantFlag }: DemoGuardInput) {
  if (env === 'production') {
    throw new Error('--demo=local is disabled when NODE_ENV=production.');
  }
  if (tenantFlag) return;
  const demoSlugs = new Set(DEMO_TENANTS.map((t) => t.slug));
  const foreign = organizations.filter((slug) => !demoSlugs.has(slug));
  if (foreign.length > 0) {
    throw new Error(
      `--demo=local refuses to run: this database already has non-demo tenants (${foreign.join(', ')}). ` +
        'If you really mean to add demo data to one of them, pass --tenant=<slug> explicitly.',
    );
  }
}
