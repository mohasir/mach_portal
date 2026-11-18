import { TRPCError } from '@trpc/server';
import type { ConsoleHistoryItem, ConsoleHistoryQuery } from '@repo/schemas';
import { AppError, ErrorCodes } from '../../../lib/errors';
import { OrganizationsRepository } from '../organizations/organizations.repository';
import { HistoryRepository } from './history.repository';

const SOURCE_ORDER = { feature: 0, access: 1, audit: 2 } as const;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export class ConsoleHistoryService {
  constructor(
    private repo: HistoryRepository,
    private organizations: OrganizationsRepository,
  ) {}

  async list({ organizationId, limit }: ConsoleHistoryQuery): Promise<ConsoleHistoryItem[]> {
    const org = await this.organizations.findById(organizationId);
    if (!org) {
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.tenant.NOT_FOUND) });
    }
    const [featureEvents, access, audit] = await Promise.all([
      this.repo.featureEvents(org.id, limit),
      this.repo.accessLog(org.id, limit),
      this.repo.auditLog(org.id, limit),
    ]);

    const items: ConsoleHistoryItem[] = [
      ...featureEvents.map((e) => ({
        source: 'feature' as const,
        id: e.id,
        createdAt: e.createdAt.toISOString(),
        actor: e.actor,
        label: `feature.${e.action}`,
        detail: { featureKey: e.featureKey, before: e.before, after: e.after },
      })),
      ...access.map((a) => ({
        source: 'access' as const,
        id: a.id,
        createdAt: a.createdAt.toISOString(),
        actor: a.email,
        label: `access.${a.type}`,
        detail: { path: a.path },
      })),
      ...audit.map((a) => ({
        source: 'audit' as const,
        id: a.id,
        createdAt: a.createdAt.toISOString(),
        actor: a.email,
        label: `audit.${a.action}`,
        detail: asRecord(a.payload),
      })),
    ];

    return items
      .sort(
        (x, y) =>
          y.createdAt.localeCompare(x.createdAt) ||
          SOURCE_ORDER[x.source] - SOURCE_ORDER[y.source] ||
          x.id.localeCompare(y.id),
      )
      .slice(0, limit);
  }
}
