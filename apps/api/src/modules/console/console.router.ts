import { router } from '../../core/trpc/trpc';
import { consoleCatalogRouter } from './catalog/catalog.router';
import { consoleFeaturesRouter } from './features/features.router';
import { consoleHistoryRouter } from './history/history.router';
import { organizationsRouter } from './organizations/organizations.router';
import { consoleSummaryRouter } from './summary/summary.router';

export const consoleRouter = router({
  organizations: organizationsRouter,
  features: consoleFeaturesRouter,
  catalog: consoleCatalogRouter,
  history: consoleHistoryRouter,
  summary: consoleSummaryRouter,
});
