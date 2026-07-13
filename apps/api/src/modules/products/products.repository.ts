import { asc, eq } from 'drizzle-orm';
import type {
  CreateOptionGroupInput,
  CreateOptionInput,
  CreateProductInput,
  UpdateOptionGroupInput,
  UpdateOptionInput,
  UpdateProductInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import { options, optionGroups, products } from '../../db/schema';
import { publicOptionColumns, publicOptionGroupColumns, publicProductColumns } from './products.resource';

export class ProductsRepository {
  constructor(private db: Database) {}

  async findTree(includeInactive: boolean) {
    const productWhere = includeInactive ? undefined : eq(products.isActive, true);
    const groupWhere = includeInactive ? undefined : eq(optionGroups.isActive, true);
    const optionWhere = includeInactive ? undefined : eq(options.isActive, true);

    const [productRows, groupRows, optionRows] = await Promise.all([
      this.db.select(publicProductColumns).from(products).where(productWhere).orderBy(asc(products.sortOrder)),
      this.db
        .select(publicOptionGroupColumns)
        .from(optionGroups)
        .where(groupWhere)
        .orderBy(asc(optionGroups.sortOrder)),
      this.db.select(publicOptionColumns).from(options).where(optionWhere).orderBy(asc(options.sortOrder)),
    ]);

    return { productRows, groupRows, optionRows };
  }

  findProductByName(name: string) {
    return this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.name, name))
      .limit(1)
      .then((r) => r[0]);
  }

  createProduct(data: CreateProductInput) {
    return this.db.insert(products).values(data).returning(publicProductColumns).then((r) => r[0]!);
  }

  updateProduct(id: string, data: UpdateProductInput) {
    return this.db
      .update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning(publicProductColumns)
      .then((r) => r[0]);
  }

  setProductActive(id: string, isActive: boolean) {
    return this.db
      .update(products)
      .set({ isActive })
      .where(eq(products.id, id))
      .returning(publicProductColumns)
      .then((r) => r[0]);
  }

  async reorderProducts(ids: string[]) {
    await this.db.transaction(async (tx) => {
      await Promise.all(ids.map((id, index) => tx.update(products).set({ sortOrder: index }).where(eq(products.id, id))));
    });
  }

  createOptionGroup(data: CreateOptionGroupInput) {
    return this.db.insert(optionGroups).values(data).returning(publicOptionGroupColumns).then((r) => r[0]!);
  }

  updateOptionGroup(id: string, data: UpdateOptionGroupInput) {
    return this.db
      .update(optionGroups)
      .set(data)
      .where(eq(optionGroups.id, id))
      .returning(publicOptionGroupColumns)
      .then((r) => r[0]);
  }

  setOptionGroupActive(id: string, isActive: boolean) {
    return this.db
      .update(optionGroups)
      .set({ isActive })
      .where(eq(optionGroups.id, id))
      .returning(publicOptionGroupColumns)
      .then((r) => r[0]);
  }

  async reorderOptionGroups(ids: string[]) {
    await this.db.transaction(async (tx) => {
      await Promise.all(
        ids.map((id, index) => tx.update(optionGroups).set({ sortOrder: index }).where(eq(optionGroups.id, id))),
      );
    });
  }

  createOption(data: CreateOptionInput) {
    return this.db.insert(options).values(data).returning(publicOptionColumns).then((r) => r[0]!);
  }

  updateOption(id: string, data: UpdateOptionInput) {
    return this.db
      .update(options)
      .set(data)
      .where(eq(options.id, id))
      .returning(publicOptionColumns)
      .then((r) => r[0]);
  }

  setOptionActive(id: string, isActive: boolean) {
    return this.db
      .update(options)
      .set({ isActive })
      .where(eq(options.id, id))
      .returning(publicOptionColumns)
      .then((r) => r[0]);
  }

  async reorderOptions(ids: string[]) {
    await this.db.transaction(async (tx) => {
      await Promise.all(ids.map((id, index) => tx.update(options).set({ sortOrder: index }).where(eq(options.id, id))));
    });
  }
}
