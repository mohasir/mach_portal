import { asc, eq } from 'drizzle-orm';
import type {
  CreateOptionGroupInput,
  CreateOptionInput,
  CreateProductInput,
  PriceTierInput,
  UpdateOptionGroupInput,
  UpdateOptionInput,
  UpdateProductInput,
} from '@repo/schemas';
import type { Database } from '../../db';
import { options, optionGroups, productPriceTiers, products } from '../../db/schema';
import {
  publicOptionColumns,
  publicOptionGroupColumns,
  publicProductColumns,
  publicTierColumns,
} from './products.resource';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export class ProductsRepository {
  constructor(private db: Database) {}

  async findTree(includeInactive: boolean) {
    const productWhere = includeInactive ? undefined : eq(products.isActive, true);
    const groupWhere = includeInactive ? undefined : eq(optionGroups.isActive, true);
    const optionWhere = includeInactive ? undefined : eq(options.isActive, true);

    const [productRows, tierRows, groupRows, optionRows] = await Promise.all([
      this.db
        .select(publicProductColumns)
        .from(products)
        .where(productWhere)
        .orderBy(asc(products.sortOrder)),
      this.db
        .select(publicTierColumns)
        .from(productPriceTiers)
        .orderBy(asc(productPriceTiers.sortOrder)),
      this.db
        .select(publicOptionGroupColumns)
        .from(optionGroups)
        .where(groupWhere)
        .orderBy(asc(optionGroups.sortOrder)),
      this.db
        .select(publicOptionColumns)
        .from(options)
        .where(optionWhere)
        .orderBy(asc(options.sortOrder)),
    ]);

    return { productRows, tierRows, groupRows, optionRows };
  }

  async findPricesTree() {
    const [productRows, tierRows] = await Promise.all([
      this.db.select(publicProductColumns).from(products).orderBy(asc(products.sortOrder)),
      this.db
        .select(publicTierColumns)
        .from(productPriceTiers)
        .orderBy(asc(productPriceTiers.sortOrder)),
    ]);

    return { productRows, tierRows };
  }

  findProductByName(name: string) {
    return this.db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.name, name))
      .limit(1)
      .then((r) => r[0]);
  }

  private async replaceTiers(tx: Tx, productId: string, tiers: PriceTierInput[]) {
    await tx.delete(productPriceTiers).where(eq(productPriceTiers.productId, productId));
    if (tiers.length > 0) {
      await tx.insert(productPriceTiers).values(
        tiers.map((tier, index) => ({
          productId,
          numPersons: tier.numPersons,
          price: tier.price,
          sortOrder: index,
        })),
      );
    }
  }

  createProduct(data: CreateProductInput) {
    return this.db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          name: data.name,
          description: data.description ?? null,
          isPremium: data.isPremium,
        })
        .returning(publicProductColumns);
      await this.replaceTiers(tx, product!.id, data.tiers);
      return product!;
    });
  }

  updateProduct(id: string, data: UpdateProductInput) {
    return this.db.transaction(async (tx) => {
      const [product] = await tx
        .update(products)
        .set({ name: data.name, description: data.description ?? null, isPremium: data.isPremium })
        .where(eq(products.id, id))
        .returning(publicProductColumns);
      if (!product) return undefined;
      await this.replaceTiers(tx, id, data.tiers);
      return product;
    });
  }

  updateTiers(id: string, tiers: PriceTierInput[]) {
    return this.db.transaction(async (tx) => {
      const [product] = await tx
        .select(publicProductColumns)
        .from(products)
        .where(eq(products.id, id));
      if (!product) return undefined;
      await this.replaceTiers(tx, id, tiers);
      const tierRows = await tx
        .select(publicTierColumns)
        .from(productPriceTiers)
        .where(eq(productPriceTiers.productId, id))
        .orderBy(asc(productPriceTiers.sortOrder));
      return { product, tierRows };
    });
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
      await Promise.all(
        ids.map((id, index) =>
          tx.update(products).set({ sortOrder: index }).where(eq(products.id, id)),
        ),
      );
    });
  }

  createOptionGroup(data: CreateOptionGroupInput) {
    return this.db
      .insert(optionGroups)
      .values({
        productId: data.productId,
        label: data.label,
        selectionType: data.selectionType,
        maxSelect: data.maxSelect ?? null,
      })
      .returning(publicOptionGroupColumns)
      .then((r) => r[0]!);
  }

  updateOptionGroup(id: string, data: UpdateOptionGroupInput) {
    return this.db
      .update(optionGroups)
      .set({
        label: data.label,
        selectionType: data.selectionType,
        maxSelect: data.maxSelect ?? null,
      })
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
        ids.map((id, index) =>
          tx.update(optionGroups).set({ sortOrder: index }).where(eq(optionGroups.id, id)),
        ),
      );
    });
  }

  createOption(data: CreateOptionInput) {
    return this.db
      .insert(options)
      .values({
        optionGroupId: data.optionGroupId,
        name: data.name,
        description: data.description ?? null,
      })
      .returning(publicOptionColumns)
      .then((r) => r[0]!);
  }

  updateOption(id: string, data: UpdateOptionInput) {
    return this.db
      .update(options)
      .set({ name: data.name, description: data.description ?? null })
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
      await Promise.all(
        ids.map((id, index) =>
          tx.update(options).set({ sortOrder: index }).where(eq(options.id, id)),
        ),
      );
    });
  }
}
