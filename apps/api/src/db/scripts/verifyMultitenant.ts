import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import postgres from 'postgres';

const HELP = `Usage: pnpm --filter api mt:verify [--pre [--platform-admin-emails=<a@x,b@y>]] [--help]

Checks a database before and after the multi-tenant migration (0001). It reads DATABASE_URL
and only runs SELECT statements.

  --pre   Legacy (pre-migration) mode: prints the row count of every table and the total, the
          user role distribution, the email of every superadmin and the accounts 0001 will make
          platform admins. Fails when the constraints 0001 replaces are missing, when data would
          collide with the new per-tenant uniques, or when a role looks like a misspelled
          superadmin (e.g. 'SuperAdmin'), which the migration would not promote. Warns when
          app_settings has no row. Run it right before db:migrate and keep the output.
  --platform-admin-emails=<list>
          With --pre: the same comma-separated list that will be passed to db:migrate as
          --set mt.platform_admin_emails=<list>. Only those accounts are promoted (fails when
          one does not exist); without it 0001 promotes every superadmin.
  (none)  Post-migration mode: prints the same counts and exits 1 listing every problem:
          - business rows with a NULL/empty tenant_id or one that is not an organization;
          - users without a membership (platform admins excepted) while organizations exist;
          - child rows whose tenant differs from their parent's tenant;
          - duplicates against the per-tenant uniques;
          - organizations without an app_settings row;
          - users whose is_platform_admin is NULL;
          - sessions without an active organization while organizations exist (platform
            admins excepted). Meant for the moment right after the migration: later on, users
            with several memberships legitimately have sessions without one.
  --help  Shows this message.

Exit code: 0 when no problem was found, 1 otherwise.`;

// Every table that carries tenant_id after 0001.
export const TENANT_TABLES = [
  'app_settings',
  'clients',
  'event_history',
  'event_payment_attachments',
  'event_payments',
  'event_reschedules',
  'event_staff',
  'event_types',
  'events',
  'notification_reads',
  'notifications',
  'option_groups',
  'options',
  'product_price_tiers',
  'products',
  'quote_assignment_history',
  'quote_line_options',
  'quote_lines',
  'quote_stage_history',
  'quote_stage_settings',
  'quotes',
  'reschedule_reasons',
  'staff',
  'state_settings',
  'templates',
  'user_preferences',
] as const;

// [child table, child column, parent table]: the child's tenant must equal the parent's.
const PARENT_LINKS: [string, string, string][] = [
  ['product_price_tiers', 'product_id', 'products'],
  ['option_groups', 'product_id', 'products'],
  ['options', 'option_group_id', 'option_groups'],
  ['quotes', 'client_id', 'clients'],
  ['quotes', 'event_type_id', 'event_types'],
  ['quote_lines', 'quote_id', 'quotes'],
  ['quote_lines', 'product_id', 'products'],
  ['quote_line_options', 'quote_line_id', 'quote_lines'],
  ['quote_line_options', 'option_id', 'options'],
  ['quote_line_options', 'option_group_id', 'option_groups'],
  ['quote_stage_history', 'quote_id', 'quotes'],
  ['quote_assignment_history', 'quote_id', 'quotes'],
  ['events', 'quote_id', 'quotes'],
  ['events', 'client_id', 'clients'],
  ['events', 'event_type_id', 'event_types'],
  ['event_staff', 'event_id', 'events'],
  ['event_staff', 'staff_id', 'staff'],
  ['event_payments', 'event_id', 'events'],
  ['event_payment_attachments', 'payment_id', 'event_payments'],
  ['event_history', 'event_id', 'events'],
  ['event_reschedules', 'event_id', 'events'],
  ['event_reschedules', 'reason_id', 'reschedule_reasons'],
  ['notification_reads', 'notification_id', 'notifications'],
];

// Business keys that 0001 makes unique per tenant (the legacy schema had them globally).
const TENANT_UNIQUES: [string, string[]][] = [
  ['products', ['name']],
  ['event_types', ['name']],
  ['reschedule_reasons', ['name']],
  ['quotes', ['seq']],
  ['quotes', ['number']],
  ['templates', ['type', 'locale']],
  ['state_settings', ['state']],
  ['user_preferences', ['user_id']],
  ['app_settings', []],
];

// Constraints of the 0000 schema that 0001 drops by name; a missing one aborts the migration.
const LEGACY_CONSTRAINTS: [string, string][] = [
  ['products', 'products_name_unique'],
  ['event_types', 'event_types_name_unique'],
  ['reschedule_reasons', 'reschedule_reasons_name_unique'],
  ['quotes', 'quotes_seq_unique'],
  ['quotes', 'quotes_number_unique'],
  ['templates', 'templates_type_locale_unique'],
  ['app_settings', 'app_settings_pkey'],
  ['state_settings', 'state_settings_pkey'],
  ['user_preferences', 'user_preferences_pkey'],
];

// Same normalization as migration 0001: case-insensitive, spaces dropped, empty entries ignored.
export function parsePlatformAdminEmails(value: string | undefined): string[] {
  return (value ?? '')
    .toLowerCase()
    .replace(/\s/g, '')
    .split(',')
    .filter((e) => e !== '');
}

export type VerifyReport = { counts: Record<string, number>; problems: string[]; notes: string[] };

const q = (name: string) => `"${name.replaceAll('"', '""')}"`;

export async function verifyMultitenant(
  url: string,
  options: { pre?: boolean; platformAdminEmails?: string } = {},
): Promise<VerifyReport> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const problems: string[] = [];
  const notes: string[] = [];
  try {
    const tableRows = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
    const tables = new Set(tableRows.map((r) => r.table_name));

    const counts: Record<string, number> = {};
    for (const table of tables) {
      const [row] = await sql.unsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${q(table)}`);
      counts[table] = row!.n;
    }

    const columnRows = await sql<{ table_name: string; column_name: string }[]>`
      SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`;
    const hasColumn = (table: string, column: string) =>
      columnRows.some((r) => r.table_name === table && r.column_name === column);

    const count = async (query: string) => {
      const [row] = await sql.unsafe<{ n: number }[]>(query);
      return row!.n;
    };

    const checkDuplicates = async () => {
      for (const [table, keys] of TENANT_UNIQUES) {
        if (!tables.has(table)) continue;
        const cols = [...(hasColumn(table, 'tenant_id') ? ['tenant_id'] : []), ...keys];
        if (cols.length === 0) {
          if (counts[table]! > 1)
            problems.push(`${table}: ${counts[table]} rows for a single tenant`);
          continue;
        }
        const list = cols.map(q).join(', ');
        const n = await count(
          `SELECT count(*)::int AS n FROM (SELECT 1 FROM ${q(table)} GROUP BY ${list} HAVING count(*) > 1) d`,
        );
        if (n > 0) problems.push(`${table}: ${n} duplicated value(s) of (${cols.join(', ')})`);
      }
    };

    if (options.pre) {
      if (tables.has('user')) {
        const roles = await sql<{ role: string; n: number }[]>`
          SELECT coalesce(role, '<null>') AS role, count(*)::int AS n FROM "user"
          GROUP BY 1 ORDER BY coalesce(role, '<null>') COLLATE "C"`;
        notes.push(`user roles: ${roles.map((r) => `${r.role}=${r.n}`).join(', ') || 'none'}`);
        const lookalikes = await sql<{ email: string; role: string }[]>`
          SELECT email, role FROM "user"
          WHERE role ~* 'super[[:space:]_-]*admin'
            AND NOT ('superadmin' = ANY (string_to_array(replace(role, ' ', ''), ',')))
          ORDER BY email`;
        for (const u of lookalikes) {
          problems.push(
            `user ${u.email}: role "${u.role}" is not exactly "superadmin" and would not become a platform admin`,
          );
        }
        const superadmins = await sql<{ email: string }[]>`
          SELECT email FROM "user"
          WHERE 'superadmin' = ANY (string_to_array(replace(coalesce(role, ''), ' ', ''), ','))
          ORDER BY email`;
        notes.push(`superadmins: ${superadmins.map((u) => u.email).join(', ') || 'none'}`);
        const listed = parsePlatformAdminEmails(options.platformAdminEmails);
        if (listed.length === 0) {
          notes.push(
            `platform admins after 0001 (no list given, every superadmin): ${superadmins.map((u) => u.email).join(', ') || 'none'}`,
          );
          notes.push(
            'To promote only some accounts: db:migrate ... --set mt.platform_admin_emails=<a@x,b@y> (check it first with --pre --platform-admin-emails=<a@x,b@y>)',
          );
        } else {
          const existing = await sql<{ email: string }[]>`
            SELECT lower(email) AS email FROM "user" WHERE lower(email) IN ${sql(listed)}`;
          const found = new Set(existing.map((u) => u.email));
          for (const email of listed) {
            if (!found.has(email))
              problems.push(`platform admin list: ${email} is not an existing user`);
          }
          notes.push(
            `platform admins after 0001 (from the list): ${[...found].sort().join(', ') || 'none'}`,
          );
        }
      }
      if (tables.has('app_settings') && counts['app_settings'] === 0) {
        notes.push(
          'WARNING: app_settings has no row; config.get fails until settings are saved once',
        );
      }
      if (tables.has('organization')) {
        console.log('Note: the organization table exists, so 0001 seems to be applied already.');
      } else {
        const present = await sql<{ conname: string }[]>`
          SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace`;
        const names = new Set(present.map((r) => r.conname));
        for (const [table, name] of LEGACY_CONSTRAINTS) {
          if (!names.has(name))
            problems.push(`${table}: expected legacy constraint ${name} is missing`);
        }
        if (tables.has('app_settings') && hasColumn('app_settings', 'id')) {
          const others = await count(`SELECT count(*)::int AS n FROM app_settings WHERE id <> 1`);
          if (others > 0)
            problems.push(`app_settings: ${others} row(s) other than the singleton id = 1`);
        }
      }
      await checkDuplicates();
      return { counts, problems, notes };
    }

    for (const table of TENANT_TABLES) {
      if (!tables.has(table) || !hasColumn(table, 'tenant_id')) {
        problems.push(`${table}: missing table or tenant_id column`);
        continue;
      }
      const missing = await count(
        `SELECT count(*)::int AS n FROM ${q(table)} WHERE tenant_id IS NULL OR tenant_id = ''`,
      );
      if (missing > 0) problems.push(`${table}: ${missing} row(s) without tenant_id`);
      const orphans = await count(
        `SELECT count(*)::int AS n FROM ${q(table)} t
         WHERE t.tenant_id <> '' AND NOT EXISTS (SELECT 1 FROM organization o WHERE o.id = t.tenant_id)`,
      );
      if (orphans > 0)
        problems.push(`${table}: ${orphans} row(s) whose tenant_id is not an organization`);
    }

    for (const [child, column, parent] of PARENT_LINKS) {
      const n = await count(
        `SELECT count(*)::int AS n FROM ${q(child)} c JOIN ${q(parent)} p ON p.id = c.${q(column)}
         WHERE c.tenant_id IS DISTINCT FROM p.tenant_id`,
      );
      if (n > 0)
        problems.push(`${child}: ${n} row(s) whose tenant differs from ${parent} (via ${column})`);
    }

    await checkDuplicates();
    const duplicatedMembers = await count(
      `SELECT count(*)::int AS n FROM (SELECT 1 FROM member GROUP BY organization_id, user_id
       HAVING count(*) > 1) d`,
    );
    if (duplicatedMembers > 0) {
      problems.push(`member: ${duplicatedMembers} duplicated (organization_id, user_id) pair(s)`);
    }

    const withoutSettings = await sql<{ slug: string }[]>`
      SELECT o.slug FROM organization o
      WHERE NOT EXISTS (SELECT 1 FROM app_settings s WHERE s.tenant_id = o.id) ORDER BY o.slug`;
    if (withoutSettings.length > 0) {
      problems.push(
        `organization: ${withoutSettings.length} without app_settings (${withoutSettings.map((r) => r.slug).join(', ')})`,
      );
    }

    const nullFlags = await count(
      `SELECT count(*)::int AS n FROM "user" WHERE is_platform_admin IS NULL`,
    );
    if (nullFlags > 0) problems.push(`user: ${nullFlags} with a NULL is_platform_admin`);
    const platformAdmins = await count(
      `SELECT count(*)::int AS n FROM "user" WHERE is_platform_admin`,
    );
    notes.push(`platform admins: ${platformAdmins}`);
    // A different member role is legitimate for accounts shared by several tenants.
    const roleMismatches = await count(
      `SELECT count(*)::int AS n FROM member m JOIN "user" u ON u.id = m.user_id
       WHERE m.role IS DISTINCT FROM u.role`,
    );
    if (roleMismatches > 0)
      notes.push(`member rows whose role differs from user.role: ${roleMismatches}`);

    if ((counts['organization'] ?? 0) > 0) {
      const withoutMember = await sql<{ email: string }[]>`
        SELECT u.email FROM "user" u
        WHERE NOT coalesce(u.is_platform_admin, false)
          AND NOT EXISTS (SELECT 1 FROM member m WHERE m.user_id = u.id)
        ORDER BY u.email`;
      if (withoutMember.length > 0) {
        problems.push(
          `user: ${withoutMember.length} without membership (${withoutMember.map((r) => r.email).join(', ')})`,
        );
      }
      const sessions = await count(
        `SELECT count(*)::int AS n FROM session s JOIN "user" u ON u.id = s.user_id
         WHERE s.active_organization_id IS NULL AND NOT coalesce(u.is_platform_admin, false)`,
      );
      if (sessions > 0) problems.push(`session: ${sessions} without an active organization`);
    }

    return { counts, problems, notes };
  } finally {
    await sql.end();
  }
}

function printReport({ counts, problems, notes }: VerifyReport) {
  const tables = Object.keys(counts).sort();
  const width = Math.max(0, ...tables.map((t) => t.length));
  for (const t of tables) console.log(`${t.padEnd(width)}  ${counts[t]}`);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  console.log(`${'TOTAL'.padEnd(width)}  ${total} rows in ${tables.length} tables`);
  if (notes.length > 0) console.log('');
  for (const n of notes) console.log(n);
  if (problems.length === 0) {
    console.log('\nOK: no problems found.');
  } else {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
  }
}

async function main(args: string[]) {
  if (args.includes('--help')) {
    console.log(HELP);
    return 0;
  }
  const emailsFlag = '--platform-admin-emails=';
  const unknown = args.filter((a) => a !== '--pre' && !a.startsWith(emailsFlag));
  if (unknown.length > 0) {
    console.error(`Unknown argument(s): ${unknown.join(' ')}\n\n${HELP}`);
    return 1;
  }
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL is required');
    return 1;
  }
  const platformAdminEmails = args.find((a) => a.startsWith(emailsFlag))?.slice(emailsFlag.length);
  const report = await verifyMultitenant(url, { pre: args.includes('--pre'), platformAdminEmails });
  printReport(report);
  return report.problems.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error('Verification failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
