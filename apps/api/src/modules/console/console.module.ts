import type { Database } from '../../db';
import { ConsoleCatalogService } from './catalog/catalog.service';
import { ConsoleFeaturesRepository } from './features/features.repository';
import { ConsoleFeaturesService } from './features/features.service';
import { HistoryRepository } from './history/history.repository';
import { ConsoleHistoryService } from './history/history.service';
import { OrganizationsRepository } from './organizations/organizations.repository';
import { OrganizationsService } from './organizations/organizations.service';
import { SummaryRepository } from './summary/summary.repository';
import { ConsoleSummaryService } from './summary/summary.service';

export function consoleModule(ctx: { platformDb: Database }) {
  const organizations = new OrganizationsRepository(ctx.platformDb);
  return {
    organizations: new OrganizationsService(organizations, ctx.platformDb),
    features: new ConsoleFeaturesService(
      new ConsoleFeaturesRepository(ctx.platformDb),
      organizations,
      ctx.platformDb,
    ),
    catalog: new ConsoleCatalogService(organizations, ctx.platformDb),
    history: new ConsoleHistoryService(new HistoryRepository(ctx.platformDb), organizations),
    summary: new ConsoleSummaryService(new SummaryRepository(ctx.platformDb), organizations),
  };
}
