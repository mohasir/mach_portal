import { TRPCError } from '@trpc/server';
import {
  paginationMeta,
  type CreateProductCategoryInput,
  type ProductCategoriesListQuery,
  type UpdateProductCategoryInput,
} from '@repo/schemas';
import {
  AppError,
  ErrorCodes,
  isPgError,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '../../lib/errors';
import { ProductCategoriesRepository } from './productCategories.repository';
import { categoryCollectionResource, categoryResource } from './productCategories.resource';

const notFound = () =>
  new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.productCategory.NOT_FOUND) });
const nameTaken = () =>
  new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.productCategory.NAME_TAKEN) });
const inUse = () =>
  new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.productCategory.IN_USE) });

// A concurrent request can take the name between the lookup and the write; the unique index then
// rejects it.
const rethrowNameTaken = (error: unknown): never => {
  if (isPgError(error, PG_UNIQUE_VIOLATION, 'product_categories_tenant_name')) throw nameTaken();
  throw error;
};

export class ProductCategoriesService {
  constructor(private repo: ProductCategoriesRepository) {}

  async list(query: ProductCategoriesListQuery) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(query);
    const resource = categoryCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async options() {
    return categoryCollectionResource(await this.repo.findActive());
  }

  async create(input: CreateProductCategoryInput) {
    if (await this.repo.findByName(input.name)) throw nameTaken();
    return categoryResource(await this.repo.create(input).catch(rethrowNameTaken));
  }

  async update(id: string, input: UpdateProductCategoryInput) {
    if (!(await this.repo.findById(id))) throw notFound();
    if (await this.repo.findByName(input.name, id)) throw nameTaken();
    const updated = await this.repo.updateById(id, input).catch(rethrowNameTaken);
    if (!updated) throw notFound();
    return categoryResource(updated);
  }

  async disable(id: string) {
    return this.setActive(id, false);
  }

  async enable(id: string) {
    return this.setActive(id, true);
  }

  // A product can take the category between the check and the DELETE; the RESTRICT foreign key
  // then rejects it.
  async remove(id: string) {
    if (!(await this.repo.findById(id))) throw notFound();
    if (await this.repo.isUsed(id)) throw inUse();
    const deleted = await this.repo.deleteById(id).catch((error: unknown) => {
      if (isPgError(error, PG_FOREIGN_KEY_VIOLATION)) throw inUse();
      throw error;
    });
    if (!deleted) throw notFound();
    return deleted;
  }

  private async setActive(id: string, isActive: boolean) {
    const updated = await this.repo.setActive(id, isActive);
    if (!updated) throw notFound();
    return categoryResource(updated);
  }
}
