import { and, asc, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import {
  FEATURES,
  FEATURE_KEYS,
  isFeatureKey,
  isToggleable,
  resolveFeatures,
  type FeatureKey,
  type FeatureRow,
} from '@repo/guards';
import type { Executor, Tx } from '../../db';
import { organization, tenantFeatureEvents, tenantFeatures } from '../../db/schema';
import { AppError, ErrorCodes } from '../errors';
import { normalizeSlug } from '../tenancy/slug';

export const BILLING_PERIODS = ['monthly', 'yearly'] as const;

export type SetFeatureInput = {
  tenantSlug: string;
  key: string;
  // Fields left undefined keep their stored value on an existing row; null clears them.
  expiresAt?: Date | null;
  priceCents?: number | null;
  billingPeriod?: string | null;
  currency?: string | null;
  actor: string;
};

export type UnsetFeatureInput = { tenantSlug: string; key: string; actor: string };

export type FeatureListItem = FeatureRow & {
  active: boolean;
  kind: string;
  activatedAt: Date;
  priceCents: number | null;
  billingPeriod: string | null;
  currency: string | null;
};

type StoredFeature = typeof tenantFeatures.$inferSelect;

const fail = (
  code: TRPCError['code'],
  appCode: ConstructorParameters<typeof AppError>[0],
  message?: string,
) => new TRPCError({ code, cause: new AppError(appCode, message) });

// Locking the organization row serializes concurrent admin commands on one tenant, so the
// dependency checks below cannot be invalidated between the read and the write.
async function lockTenant(tx: Tx, slug: string): Promise<string> {
  const [org] = await tx
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, normalizeSlug(slug)))
    .for('update')
    .limit(1);
  if (!org) throw fail('NOT_FOUND', ErrorCodes.tenant.NOT_FOUND, `Tenant "${slug}" does not exist`);
  return org.id;
}

function toggleableKey(key: string): FeatureKey {
  if (!isFeatureKey(key)) {
    throw fail(
      'BAD_REQUEST',
      ErrorCodes.feature.UNKNOWN_KEY,
      `Unknown feature "${key}". Known: ${FEATURE_KEYS.join(', ')}`,
    );
  }
  if (!isToggleable(key)) {
    throw fail(
      'BAD_REQUEST',
      ErrorCodes.feature.NOT_TOGGLEABLE,
      `"${key}" is a core feature and is always on`,
    );
  }
  return key;
}

const featureRows = (tx: Tx, tenantId: string) =>
  tx.select().from(tenantFeatures).where(eq(tenantFeatures.tenantId, tenantId));

const isLive = (row: Pick<StoredFeature, 'enabled' | 'expiresAt'>, now: Date) =>
  row.enabled && (row.expiresAt === null || row.expiresAt.getTime() > now.getTime());

// Judged on the stored rows, not on resolved state: resolving drops a dependent as soon as its
// requirement lapses, which would hide it here and let the requirement be turned off under it.
function liveDependents(rows: readonly StoredFeature[], key: FeatureKey, now: Date): FeatureKey[] {
  return rows
    .filter((r) => isFeatureKey(r.featureKey) && FEATURES[r.featureKey].requires.includes(key))
    .filter((r) => isLive(r, now))
    .map((r) => r.featureKey)
    .sort();
}

const hasDependents = (key: FeatureKey, dependents: FeatureKey[]) =>
  fail(
    'PRECONDITION_FAILED',
    ErrorCodes.feature.HAS_DEPENDENTS,
    `"${key}" is required by active ${dependents.join(', ')}; disable those first`,
  );

const snapshot = (row: StoredFeature | undefined) => (row ? { ...row } : null);

export async function setFeature(
  database: Executor,
  input: SetFeatureInput,
): Promise<StoredFeature> {
  return database.transaction(async (tx) => {
    const tenantId = await lockTenant(tx, input.tenantSlug);
    const key = toggleableKey(input.key);

    const rows = await featureRows(tx, tenantId);
    const active = resolveFeatures(rows, new Date());
    const missing = FEATURES[key].requires.filter((dep) => !active.has(dep));
    if (missing.length > 0) {
      throw fail(
        'PRECONDITION_FAILED',
        ErrorCodes.feature.MISSING_DEPENDENCY,
        `"${key}" requires an active ${missing.join(', ')}`,
      );
    }

    const before = rows.find((r) => r.featureKey === key);
    const values = {
      enabled: true,
      expiresAt: input.expiresAt === undefined ? (before?.expiresAt ?? null) : input.expiresAt,
      priceCents: input.priceCents === undefined ? (before?.priceCents ?? null) : input.priceCents,
      billingPeriod:
        input.billingPeriod === undefined ? (before?.billingPeriod ?? null) : input.billingPeriod,
      currency: input.currency === undefined ? (before?.currency ?? null) : input.currency,
    };

    const now = new Date();
    if (values.expiresAt !== null && values.expiresAt.getTime() <= now.getTime()) {
      const dependents = liveDependents(rows, key, now);
      if (dependents.length > 0) throw hasDependents(key, dependents);
    }
    const [after] = before
      ? await tx
          .update(tenantFeatures)
          .set({ ...values, ...(before.enabled ? {} : { activatedAt: now }), updatedAt: now })
          .where(and(eq(tenantFeatures.tenantId, tenantId), eq(tenantFeatures.featureKey, key)))
          .returning()
      : await tx
          .insert(tenantFeatures)
          .values({ tenantId, featureKey: key, ...values })
          .returning();

    await tx.insert(tenantFeatureEvents).values({
      tenantId,
      featureKey: key,
      action: before?.enabled ? 'updated' : 'enabled',
      before: snapshot(before),
      after: snapshot(after),
      actor: input.actor,
    });
    return after!;
  });
}

export async function unsetFeature(
  database: Executor,
  input: UnsetFeatureInput,
): Promise<StoredFeature> {
  return database.transaction(async (tx) => {
    const tenantId = await lockTenant(tx, input.tenantSlug);
    const key = toggleableKey(input.key);

    const rows = await featureRows(tx, tenantId);
    const before = rows.find((r) => r.featureKey === key);
    if (!before) {
      throw fail(
        'NOT_FOUND',
        ErrorCodes.feature.NOT_ENABLED,
        `"${key}" was never enabled for this tenant`,
      );
    }

    const dependents = liveDependents(rows, key, new Date());
    if (dependents.length > 0) throw hasDependents(key, dependents);

    // The row stays (disabled) so price and dates survive a later re-enable.
    const [after] = await tx
      .update(tenantFeatures)
      .set({ enabled: false, updatedAt: new Date() })
      .where(and(eq(tenantFeatures.tenantId, tenantId), eq(tenantFeatures.featureKey, key)))
      .returning();

    await tx.insert(tenantFeatureEvents).values({
      tenantId,
      featureKey: key,
      action: 'disabled',
      before: snapshot(before),
      after: snapshot(after),
      actor: input.actor,
    });
    return after!;
  });
}

export async function listFeatures(
  database: Executor,
  tenantSlug: string,
): Promise<FeatureListItem[]> {
  return database.transaction(async (tx) => {
    const [org] = await tx
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, normalizeSlug(tenantSlug)))
      .limit(1);
    if (!org) {
      throw fail('NOT_FOUND', ErrorCodes.tenant.NOT_FOUND, `Tenant "${tenantSlug}" does not exist`);
    }
    const rows = await tx
      .select()
      .from(tenantFeatures)
      .where(eq(tenantFeatures.tenantId, org.id))
      .orderBy(asc(tenantFeatures.featureKey));
    const active = resolveFeatures(rows, new Date());
    return rows.map((r) => ({
      ...r,
      active: active.has(r.featureKey),
      // A key outside the catalog can only come from a manual edit; list it rather than crash.
      kind: isFeatureKey(r.featureKey) ? FEATURES[r.featureKey].kind : 'unknown',
    }));
  });
}
