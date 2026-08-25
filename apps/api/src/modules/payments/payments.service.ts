import { paginationMeta, type PaymentsIncomeQuery, type PaymentsListQuery } from '@repo/schemas';
import { PaymentsRepository } from './payments.repository';
import { paymentCollectionResource, paymentIncomeItemResource } from './payments.resource';

export class PaymentsService {
  constructor(private repo: PaymentsRepository) {}

  async list(query: PaymentsListQuery) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(query);
    const resource = paymentCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async income(query: PaymentsIncomeQuery) {
    const rows = await this.repo.findIncome(query);
    const items = rows.map(paymentIncomeItemResource);
    return { items, totalAmount: items.reduce((sum, r) => sum + r.totalAmount, 0) };
  }
}
