import { paginationMeta, type PaymentsIncomeQuery, type PaymentsListQuery } from '@repo/schemas';
import { PaymentsRepository } from './payments.repository';
import { paymentCollectionResource, paymentIncomeItemResource } from './payments.resource';

export class PaymentsService {
  constructor(private repo: PaymentsRepository) {}

  // `ownerId` restricts to payments of events whose quote that user created or is assigned to.
  async list(query: PaymentsListQuery, ownerId?: string) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(
      query,
      ownerId,
    );
    const resource = paymentCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async income(query: PaymentsIncomeQuery, ownerId?: string) {
    const rows = await this.repo.findIncome(query, ownerId);
    const items = rows.map(paymentIncomeItemResource);
    return { items, totalAmount: items.reduce((sum, r) => sum + r.totalAmount, 0) };
  }
}
