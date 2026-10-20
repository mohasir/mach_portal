import { asc, eq, max } from 'drizzle-orm';
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
import {
  options,
  optionGroups,
  productPriceTiers,
  products,
  quoteLineOptions,
} from '../../db/schema';
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

  async findUsage() {
    const rows = await this.db
      .selectDistinct({
        optionId: quoteLineOptions.optionId,
        optionGroupId: quoteLineOptions.optionGroupId,
      })
      .from(quoteLineOptions);

    return {
      optionIds: new Set(rows.map((r) => r.optionId)),
      groupIds: new Set(rows.map((r) => r.optionGroupId)),
    };
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

  findProductById(id: string) {
    return this.db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.id, id))
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

  duplicateProduct(id: string, name: string) {
    return this.db.transaction(async (tx) => {
      const [source] = await tx.select().from(products).where(eq(products.id, id));
      if (!source) return undefined;

      const [last] = await tx.select({ value: max(products.sortOrder) }).from(products);
      const [copy] = await tx
        .insert(products)
        .values({
          name,
          description: source.description,
          isPremium: source.isPremium,
          isActive: true,
          sortOrder: (last?.value ?? -1) + 1,
        })
        .returning(publicProductColumns);

      const tiers = await tx
        .select()
        .from(productPriceTiers)
        .where(eq(productPriceTiers.productId, id));
      if (tiers.length > 0) {
        await tx.insert(productPriceTiers).values(
          tiers.map((tier) => ({
            productId: copy!.id,
            numPersons: tier.numPersons,
            price: tier.price,
            sortOrder: tier.sortOrder,
          })),
        );
      }

      const groups = await tx.select().from(optionGroups).where(eq(optionGroups.productId, id));
      for (const group of groups) {
        const [groupCopy] = await tx
          .insert(optionGroups)
          .values({
            productId: copy!.id,
            label: group.label,
            selectionType: group.selectionType,
            maxSelect: group.maxSelect,
            isActive: group.isActive,
            sortOrder: group.sortOrder,
          })
          .returning({ id: optionGroups.id });
        const groupOptions = await tx
          .select()
          .from(options)
          .where(eq(options.optionGroupId, group.id));
        if (groupOptions.length > 0) {
          await tx.insert(options).values(
            groupOptions.map((option) => ({
              optionGroupId: groupCopy!.id,
              name: option.name,
              description: option.description,
              isActive: option.isActive,
              sortOrder: option.sortOrder,
            })),
          );
        }
      }

      return copy!;
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

  isOptionGroupUsed(id: string) {
    return this.db
      .select({ id: quoteLineOptions.id })
      .from(quoteLineOptions)
      .where(eq(quoteLineOptions.optionGroupId, id))
      .limit(1)
      .then((r) => r.length > 0);
  }

  deleteOptionGroup(id: string) {
    return this.db
      .delete(optionGroups)
      .where(eq(optionGroups.id, id))
      .returning({ id: optionGroups.id })
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

  isOptionUsed(id: string) {
    return this.db
      .select({ id: quoteLineOptions.id })
      .from(quoteLineOptions)
      .where(eq(quoteLineOptions.optionId, id))
      .limit(1)
      .then((r) => r.length > 0);
  }

  deleteOption(id: string) {
    return this.db
      .delete(options)
      .where(eq(options.id, id))
      .returning({ id: options.id })
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
