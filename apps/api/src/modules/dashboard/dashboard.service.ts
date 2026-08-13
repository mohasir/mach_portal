import { QUOTE_STAGE } from '@repo/schemas';
import type {
  DashboardQuotesByMonthQuery,
  DashboardSummaryQuery,
  DashboardTopProductsQuery,
} from '@repo/schemas';
import { DashboardRepository } from './dashboard.repository';

export class DashboardService {
  constructor(private repo: DashboardRepository) {}

  async summary(query: DashboardSummaryQuery) {
    const { month, year } = query;
    const [eventsCount, revenue, stageCounts] = await Promise.all([
      this.repo.countEvents(month, year),
      this.repo.sumRevenue(month, year),
      this.repo.quotesStageCounts(month, year),
    ]);

    const quotesCount = stageCounts.reduce((sum, row) => sum + row.value, 0);
    const confirmedCount =
      stageCounts.find((row) => row.stageId === QUOTE_STAGE.CONFIRMED)?.value ?? 0;
    const closeRate = quotesCount > 0 ? confirmedCount / quotesCount : 0;

    return { eventsCount, revenue, quotesCount, closeRate };
  }

  async quotesByMonth(query: DashboardQuotesByMonthQuery) {
    const rows = await this.repo.quotesByMonth(query.year);
    const byMonth = new Map(rows.map((row) => [row.month, row.value]));
    return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: byMonth.get(i + 1) ?? 0 }));
  }

  async topProducts(query: DashboardTopProductsQuery) {
    const rows = await this.repo.topProducts(query.month, query.year, query.limit);
    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      count: row.value,
    }));
  }
}
