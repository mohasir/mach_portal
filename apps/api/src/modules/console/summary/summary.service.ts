import { TRPCError } from '@trpc/server';
import { expiryStatus } from '@repo/guards';
import type { ConsoleGlobalSummary, ConsoleOrganizationSummary } from '@repo/schemas';
import { AppError, ErrorCodes } from '../../../lib/errors';
import { OrganizationsRepository } from '../organizations/organizations.repository';
import { SummaryRepository } from './summary.repository';

const MAX_EXPIRING = 20;

export class ConsoleSummaryService {
  constructor(
    private repo: SummaryRepository,
    private organizations: OrganizationsRepository,
  ) {}

  async global(): Promise<ConsoleGlobalSummary> {
    const now = new Date();
    const [totals, features] = await Promise.all([
      this.repo.totals(),
      this.repo.enabledWithExpiry(),
    ]);
    const expiringFeatures = features
      .filter((f) => expiryStatus(f.expiresAt, now).state === 'expiringSoon')
      .slice(0, MAX_EXPIRING)
      .map((f) => ({
        organizationId: f.organizationId,
        organizationName: f.organizationName,
        featureKey: f.featureKey,
        expiresAt: f.expiresAt!.toISOString(),
      }));
    return { ...totals, expiringFeatures };
  }

  async organization(organizationId: string): Promise<ConsoleOrganizationSummary> {
    const org = await this.organizations.findById(organizationId);
    if (!org) {
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.tenant.NOT_FOUND) });
    }
    const { quotesByStage, ...counts } = await this.repo.countsFor(org.id);
    return {
      ...counts,
      quotesByStage: quotesByStage.map((r) => ({ stageId: r.stageId, label: r.label, count: r.n })),
    };
  }
}
