import { TRPCError } from '@trpc/server';
import { FEATURES, FEATURE_KEYS, isToggleable, resolveFeatures } from '@repo/guards';
import type {
  ConsoleFeature,
  SetConsoleFeatureInput,
  UnsetConsoleFeatureInput,
} from '@repo/schemas';
import type { Database } from '../../../db';
import { recordPlatformAudit } from '../../../core/trpc/platformAudit';
import { AppError, ErrorCodes } from '../../../lib/errors';
import { setFeature, unsetFeature } from '../../../lib/features/admin';
import { clearFeatureCache } from '../../../lib/features/cache';
import { parseExpiryDate } from '../../../lib/features/expiry';
import { OrganizationsRepository } from '../organizations/organizations.repository';
import { ConsoleFeaturesRepository } from './features.repository';

type Actor = { userId: string; email: string };

export class ConsoleFeaturesService {
  constructor(
    private repo: ConsoleFeaturesRepository,
    private organizations: OrganizationsRepository,
    private db: Database,
  ) {}

  private async organization(id: string) {
    const org = await this.organizations.findById(id);
    if (!org) {
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.tenant.NOT_FOUND) });
    }
    return org;
  }

  async list(organizationId: string): Promise<ConsoleFeature[]> {
    await this.organization(organizationId);
    const rows = await this.repo.findByOrganization(organizationId);
    const active = resolveFeatures(rows, new Date());
    const byKey = new Map(rows.map((r) => [r.featureKey, r]));
    return FEATURE_KEYS.filter(isToggleable).map((key) => {
      const row = byKey.get(key);
      return {
        key,
        kind: FEATURES[key].kind,
        enabled: row?.enabled ?? false,
        active: active.has(key),
        activatedAt: row?.activatedAt.toISOString() ?? null,
        expiresAt: row?.expiresAt?.toISOString() ?? null,
        priceCents: row?.priceCents ?? null,
        billingPeriod: row?.billingPeriod ?? null,
        currency: row?.currency ?? null,
      };
    });
  }

  async set(input: SetConsoleFeatureInput, actor: Actor): Promise<void> {
    const org = await this.organization(input.organizationId);
    const expiresAt =
      input.expiresOn === undefined || input.expiresOn === null
        ? input.expiresOn
        : parseExpiryDate(input.expiresOn);
    await this.db.transaction(async (tx) => {
      const row = await setFeature(tx, {
        tenantSlug: org.slug,
        key: input.key,
        expiresAt,
        priceCents: input.priceCents,
        billingPeriod: input.billingPeriod,
        currency: input.currency,
        actor: actor.email,
      });
      await recordPlatformAudit(tx, {
        userId: actor.userId,
        action: 'feature.set',
        tenantId: org.id,
        payload: {
          key: input.key,
          expiresAt: row.expiresAt?.toISOString() ?? null,
          priceCents: row.priceCents,
          billingPeriod: row.billingPeriod,
          currency: row.currency,
        },
      });
    });
    clearFeatureCache(org.id);
  }

  async unset(input: UnsetConsoleFeatureInput, actor: Actor): Promise<void> {
    const org = await this.organization(input.organizationId);
    await this.db.transaction(async (tx) => {
      await unsetFeature(tx, { tenantSlug: org.slug, key: input.key, actor: actor.email });
      await recordPlatformAudit(tx, {
        userId: actor.userId,
        action: 'feature.unset',
        tenantId: org.id,
        payload: { key: input.key },
      });
    });
    clearFeatureCache(org.id);
  }
}
