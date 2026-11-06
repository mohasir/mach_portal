import { and, asc, eq, type SQL } from 'drizzle-orm';
import type {
  CreateOptionGroupInput,
  CreateOptionInput,
  CreateProductInput,
  PriceTierInput,
  UpdateOptionGroupInput,
  UpdateOptionInput,
  UpdateProductInput,
} from '@repo/schemas';
import type { Database, Tx } from '../../db';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import { options, optionGroups, productPriceTiers, products } from '../../db/schema';
import {
  publicOptionColumns,
  publicOptionGroupColumns,
  publicProductColumns,
  publicTierColumns,
} from './products.resource';

export class ProductsRepository {
  constructor(
    private db: Database,
    private tenantId: string,
  ) {}

  async findTree(includeInactive: boolean) {
    const activeOnly = (col: SQL | undefined) => (includeInactive ? undefined : col);
    const productWhere = and(
      tenantEq(products, this.tenantId),
      activeOnly(eq(products.isActive, true)),
    );
    const tierWhere = tenantEq(productPriceTiers, this.tenantId);
    const groupWhere = and(
      tenantEq(optionGroups, this.tenantId),
      activeOnly(eq(optionGroups.isActive, true)),
    );
    const optionWhere = and(
      tenantEq(options, this.tenantId),
      activeOnly(eq(options.isActive, true)),
    );

    const [productRows, tierRows, groupRows, optionRows] = await Promise.all([
      this.db
        .select(publicProductColumns)
        .from(products)
        .where(productWhere)
        .orderBy(asc(products.sortOrder)),
      this.db
        .select(publicTierColumns)
        .from(productPriceTiers)
        .where(tierWhere)
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
      this.db
        .select(publicProductColumns)
        .from(products)
        .where(tenantEq(products, this.tenantId))
        .orderBy(asc(products.sortOrder)),
      this.db
        .select(publicTierColumns)
        .from(productPriceTiers)
        .where(tenantEq(productPriceTiers, this.tenantId))
        .orderBy(asc(productPriceTiers.sortOrder)),
    ]);

    return { productRows, tierRows };
  }

  findProductByName(name: string) {
    return this.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.name, name), tenantEq(products, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  private async replaceTiers(tx: Tx, productId: string, tiers: PriceTierInput[]) {
    await tx
      .delete(productPriceTiers)
      .where(
        and(eq(productPriceTiers.productId, productId), tenantEq(productPriceTiers, this.tenantId)),
      );
    if (tiers.length > 0) {
      await tx.insert(productPriceTiers).values(
        tiers.map((tier, index) => ({
          productId,
          numPersons: tier.numPersons,
          price: tier.price,
          sortOrder: index,
          tenantId: this.tenantId,
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
          tenantId: this.tenantId,
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
        .where(and(eq(products.id, id), tenantEq(products, this.tenantId)))
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
        .where(and(eq(products.id, id), tenantEq(products, this.tenantId)));
      if (!product) return undefined;
      await this.replaceTiers(tx, id, tiers);
      const tierRows = await tx
        .select(publicTierColumns)
        .from(productPriceTiers)
        .where(and(eq(productPriceTiers.productId, id), tenantEq(productPriceTiers, this.tenantId)))
        .orderBy(asc(productPriceTiers.sortOrder));
      return { product, tierRows };
    });
  }

  setProductActive(id: string, isActive: boolean) {
    return this.db
      .update(products)
      .set({ isActive })
      .where(and(eq(products.id, id), tenantEq(products, this.tenantId)))
      .returning(publicProductColumns)
      .then((r) => r[0]);
  }

  async reorderProducts(ids: string[]) {
    await this.db.transaction(async (tx) => {
      await Promise.all(
        ids.map((id, index) =>
          tx
            .update(products)
            .set({ sortOrder: index })
            .where(and(eq(products.id, id), tenantEq(products, this.tenantId))),
        ),
      );
    });
  }

  // The DB does not validate the tenant on foreign keys, so the parent is resolved first.
  async createOptionGroup(data: CreateOptionGroupInput) {
    const [parent] = await this.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, data.productId), tenantEq(products, this.tenantId)));
    if (!parent) return undefined;
    const [group] = await this.db
      .insert(optionGroups)
      .values({
        productId: data.productId,
        label: data.label,
        selectionType: data.selectionType,
        maxSelect: data.maxSelect ?? null,
        tenantId: this.tenantId,
      })
      .returning(publicOptionGroupColumns);
    return group!;
  }

  updateOptionGroup(id: string, data: UpdateOptionGroupInput) {
    return this.db
      .update(optionGroups)
      .set({
        label: data.label,
        selectionType: data.selectionType,
        maxSelect: data.maxSelect ?? null,
      })
      .where(and(eq(optionGroups.id, id), tenantEq(optionGroups, this.tenantId)))
      .returning(publicOptionGroupColumns)
      .then((r) => r[0]);
  }

  setOptionGroupActive(id: string, isActive: boolean) {
    return this.db
      .update(optionGroups)
      .set({ isActive })
      .where(and(eq(optionGroups.id, id), tenantEq(optionGroups, this.tenantId)))
      .returning(publicOptionGroupColumns)
      .then((r) => r[0]);
  }

  async reorderOptionGroups(ids: string[]) {
    await this.db.transaction(async (tx) => {
      await Promise.all(
        ids.map((id, index) =>
          tx
            .update(optionGroups)
            .set({ sortOrder: index })
            .where(and(eq(optionGroups.id, id), tenantEq(optionGroups, this.tenantId))),
        ),
      );
    });
  }

  async createOption(data: CreateOptionInput) {
    const [parent] = await this.db
      .select({ id: optionGroups.id })
      .from(optionGroups)
      .where(and(eq(optionGroups.id, data.optionGroupId), tenantEq(optionGroups, this.tenantId)));
    if (!parent) return undefined;
    const [option] = await this.db
      .insert(options)
      .values({
        optionGroupId: data.optionGroupId,
        name: data.name,
        description: data.description ?? null,
        tenantId: this.tenantId,
      })
      .returning(publicOptionColumns);
    return option!;
  }

  updateOption(id: string, data: UpdateOptionInput) {
    return this.db
      .update(options)
      .set({ name: data.name, description: data.description ?? null })
      .where(and(eq(options.id, id), tenantEq(options, this.tenantId)))
      .returning(publicOptionColumns)
      .then((r) => r[0]);
  }

  setOptionActive(id: string, isActive: boolean) {
    return this.db
      .update(options)
      .set({ isActive })
      .where(and(eq(options.id, id), tenantEq(options, this.tenantId)))
      .returning(publicOptionColumns)
      .then((r) => r[0]);
  }

  async reorderOptions(ids: string[]) {
    await this.db.transaction(async (tx) => {
      await Promise.all(
        ids.map((id, index) =>
          tx
            .update(options)
            .set({ sortOrder: index })
            .where(and(eq(options.id, id), tenantEq(options, this.tenantId))),
        ),
      );
    });
  }
}
