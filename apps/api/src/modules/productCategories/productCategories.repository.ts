import { and, asc, count, desc, eq, ilike, ne, sql, type SQL } from 'drizzle-orm';
import type {
  CreateProductCategoryInput,
  ProductCategoriesListQuery,
  UpdateProductCategoryInput,
} from '@repo/schemas';
import type { Executor } from '../../db';
import { productCategories, products } from '../../db/schema';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { resolvePagination } from '../../lib/utils/pagination';
import { containsPattern } from '../../lib/utils/search';
import { publicCategoryColumns } from './productCategories.resource';

const sortColumns = {
  name: productCategories.name,
  isActive: productCategories.isActive,
  sortOrder: productCategories.sortOrder,
} as const;

export class ProductCategoriesRepository {
  constructor(
    private db: Executor,
    private tenantId: string,
  ) {}

  private get columns() {
    // Built with eq()/and() so the columns stay table-qualified inside the correlated subquery.
    const match = and(
      eq(products.categoryId, productCategories.id),
      tenantEq(products, this.tenantId),
    );
    return {
      ...publicCategoryColumns,
      productCount: sql<number>`(select count(*)::int from ${products} where ${match})`,
    };
  }

  async findPaginated(query: ProductCategoriesListQuery) {
    const { search, sortBy, sortDir, isActive } = query;
    const where = and(
      tenantEq(productCategories, this.tenantId),
      search ? ilike(productCategories.name, containsPattern(search)) : undefined,
      isActive === undefined ? undefined : eq(productCategories.isActive, isActive),
    );
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);
    const { limit, offset, paginate, page, pageSize } = resolvePagination(query);

    const items = await this.db
      .select(this.columns)
      .from(productCategories)
      .where(where)
      .orderBy(orderBy, asc(productCategories.sortOrder), asc(productCategories.name))
      .limit(limit)
      .offset(offset);

    const total = paginate ? await this.countAll(where) : items.length;
    return { items, total, paginate, page, pageSize };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db.select({ value: count() }).from(productCategories).where(where);
    return row?.value ?? 0;
  }

  findActive() {
    return this.db
      .select(this.columns)
      .from(productCategories)
      .where(and(tenantEq(productCategories, this.tenantId), eq(productCategories.isActive, true)))
      .orderBy(asc(productCategories.sortOrder), asc(productCategories.name));
  }

  findById(id: string) {
    return this.db
      .select(this.columns)
      .from(productCategories)
      .where(and(eq(productCategories.id, id), tenantEq(productCategories, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  // Case-insensitive, like the unique index on (tenant_id, lower(name)).
  findByName(name: string, excludeId?: string): Promise<{ id: string } | undefined> {
    return this.db
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(
        and(
          sql`lower(${productCategories.name}) = lower(${name})`,
          tenantEq(productCategories, this.tenantId),
          excludeId ? ne(productCategories.id, excludeId) : undefined,
        ),
      )
      .limit(1)
      .then((r) => r[0]);
  }

  isUsed(id: string) {
    return this.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.categoryId, id), tenantEq(products, this.tenantId)))
      .limit(1)
      .then((r) => r.length > 0);
  }

  async create(data: CreateProductCategoryInput) {
    const [last] = await this.db
      .select({ value: sql<number>`coalesce(max(${productCategories.sortOrder}), -1)::int` })
      .from(productCategories)
      .where(tenantEq(productCategories, this.tenantId));
    const [row] = await this.db
      .insert(productCategories)
      .values({ name: data.name, sortOrder: (last?.value ?? -1) + 1, tenantId: this.tenantId })
      .returning({ id: productCategories.id });
    return (await this.findById(row!.id))!;
  }

  async updateById(id: string, data: UpdateProductCategoryInput) {
    const [row] = await this.db
      .update(productCategories)
      .set({ name: data.name })
      .where(and(eq(productCategories.id, id), tenantEq(productCategories, this.tenantId)))
      .returning({ id: productCategories.id });
    return row ? this.findById(row.id) : undefined;
  }

  async setActive(id: string, isActive: boolean) {
    const [row] = await this.db
      .update(productCategories)
      .set({ isActive })
      .where(and(eq(productCategories.id, id), tenantEq(productCategories, this.tenantId)))
      .returning({ id: productCategories.id });
    return row ? this.findById(row.id) : undefined;
  }

  deleteById(id: string) {
    return this.db
      .delete(productCategories)
      .where(and(eq(productCategories.id, id), tenantEq(productCategories, this.tenantId)))
      .returning({ id: productCategories.id })
      .then((r) => r[0]);
  }
}
