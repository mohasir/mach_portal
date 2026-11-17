import { and, asc, eq, max, ne, sql, type SQL } from 'drizzle-orm';
import type {
  CreateOptionGroupInput,
  CreateOptionInput,
  CreateProductInput,
  PriceTierInput,
  UpdateOptionGroupInput,
  UpdateOptionInput,
} from '@repo/schemas';
import type { Executor, Tx } from '../../db';
import { tenantEq } from '../../lib/tenancy/tenantEq';
import {
  options,
  optionGroups,
  productCategories,
  productPriceTiers,
  products,
  quoteLineOptions,
  quoteLines,
  unitsOfMeasure,
} from '../../db/schema';
import { ProductImagesRepository } from './products.images.repository';
import {
  categoryRefColumns,
  productCostColumns,
  publicOptionColumns,
  publicOptionGroupColumns,
  publicProductColumns,
  publicTierColumns,
  unitRefColumns,
  type CategoriesById,
  type UnitsById,
} from './products.resource';

// The cost is selected only when the caller states it may read it; every read defaults to
// leaving it out.
const productColumns = (withCost: boolean) =>
  withCost ? productCostColumns : publicProductColumns;

// `tiers` left undefined keeps the stored tiers; an array (even empty) replaces them.
export type ProductWriteInput = Omit<CreateProductInput, 'tiers'> & { tiers?: PriceTierInput[] };

export class ProductsRepository {
  private images: ProductImagesRepository;

  constructor(
    private db: Executor,
    private tenantId: string,
  ) {
    this.images = new ProductImagesRepository(db, tenantId);
  }

  async findTree(includeInactive: boolean, withCost = false) {
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

    const [productRows, tierRows, groupRows, optionRows, units, categories, images] =
      await Promise.all([
        this.db
          .select(productColumns(withCost))
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
        this.findUnits(),
        this.findCategories(),
        this.images.listAll(),
      ]);

    return {
      productRows,
      tierRows,
      groupRows,
      optionRows,
      lookups: { units, categories, images },
    };
  }

  // Every unit of the tenant, inactive ones included: a product may keep a unit disabled later.
  async findUnits(): Promise<UnitsById> {
    const rows = await this.db
      .select(unitRefColumns)
      .from(unitsOfMeasure)
      .where(tenantEq(unitsOfMeasure, this.tenantId));
    return new Map(rows.map((row) => [row.id, row]));
  }

  // Every category of the tenant, inactive ones included: a product keeps a category disabled later.
  async findCategories(): Promise<CategoriesById> {
    const rows = await this.db
      .select(categoryRefColumns)
      .from(productCategories)
      .where(tenantEq(productCategories, this.tenantId));
    return new Map(rows.map((row) => [row.id, row]));
  }

  findProductImages(productId: string) {
    return this.images.listByProduct(productId);
  }

  findCategory(id: string) {
    return this.db
      .select(categoryRefColumns)
      .from(productCategories)
      .where(and(eq(productCategories.id, id), tenantEq(productCategories, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  // Case-insensitive, like the unique index on (tenant_id, lower(sku)).
  findProductBySku(sku: string, excludeId?: string) {
    return this.db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          sql`lower(${products.sku}) = lower(${sku})`,
          tenantEq(products, this.tenantId),
          excludeId ? ne(products.id, excludeId) : undefined,
        ),
      )
      .limit(1)
      .then((r) => r[0]);
  }

  findUnit(id: string) {
    return this.db
      .select({ ...unitRefColumns, isActive: unitsOfMeasure.isActive })
      .from(unitsOfMeasure)
      .where(and(eq(unitsOfMeasure.id, id), tenantEq(unitsOfMeasure, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  // Catalog rows that a quote line already references; they can only be deactivated.
  async findUsage() {
    const lineRows = await this.db
      .selectDistinct({ productId: quoteLines.productId })
      .from(quoteLines)
      .where(tenantEq(quoteLines, this.tenantId));
    const rows = await this.db
      .selectDistinct({
        optionId: quoteLineOptions.optionId,
        optionGroupId: quoteLineOptions.optionGroupId,
      })
      .from(quoteLineOptions)
      .where(tenantEq(quoteLineOptions, this.tenantId));

    return {
      optionIds: new Set(rows.map((r) => r.optionId)),
      groupIds: new Set(rows.map((r) => r.optionGroupId)),
      productIds: new Set(lineRows.map((r) => r.productId)),
    };
  }

  async isProductQuoted(productId: string) {
    const [row] = await this.db
      .select({ id: quoteLines.id })
      .from(quoteLines)
      .where(and(eq(quoteLines.productId, productId), tenantEq(quoteLines, this.tenantId)))
      .limit(1);
    return !!row;
  }

  async findPricesTree(withCost = false) {
    const [productRows, tierRows, units, categories, images] = await Promise.all([
      this.db
        .select(productColumns(withCost))
        .from(products)
        .where(tenantEq(products, this.tenantId))
        .orderBy(asc(products.sortOrder)),
      this.db
        .select(publicTierColumns)
        .from(productPriceTiers)
        .where(tenantEq(productPriceTiers, this.tenantId))
        .orderBy(asc(productPriceTiers.sortOrder)),
      this.findUnits(),
      this.findCategories(),
      this.images.listAll(),
    ]);

    return { productRows, tierRows, lookups: { units, categories, images } };
  }

  findProductByName(name: string) {
    return this.db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.name, name), tenantEq(products, this.tenantId)))
      .limit(1)
      .then((r) => r[0]);
  }

  findProductById(id: string) {
    return this.db
      .select({
        id: products.id,
        name: products.name,
        uomId: products.uomId,
        categoryId: products.categoryId,
      })
      .from(products)
      .where(and(eq(products.id, id), tenantEq(products, this.tenantId)))
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
          quantity: tier.quantity,
          price: tier.price,
          sortOrder: index,
          tenantId: this.tenantId,
        })),
      );
    }
  }

  createProduct(data: ProductWriteInput, withCost = false) {
    return this.db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          name: data.name,
          shortDescription: data.shortDescription ?? null,
          longDescription: data.longDescription ?? null,
          isPremium: data.isPremium,
          price: data.price ?? null,
          uomId: data.uomId,
          categoryId: data.categoryId ?? null,
          sku: data.sku ?? null,
          cost: data.cost ?? null,
          ...(data.minQuantity !== undefined && { minQuantity: data.minQuantity }),
          tenantId: this.tenantId,
        })
        .returning(productColumns(withCost));
      if (data.tiers) await this.replaceTiers(tx, product!.id, data.tiers);
      return product!;
    });
  }

  // The SKU identifies one product, so the copy starts without one.
  duplicateProduct(id: string, name: string, withCost = false) {
    return this.db.transaction(async (tx) => {
      const [source] = await tx
        .select()
        .from(products)
        .where(and(eq(products.id, id), tenantEq(products, this.tenantId)));
      if (!source) return undefined;

      const [last] = await tx
        .select({ value: max(products.sortOrder) })
        .from(products)
        .where(tenantEq(products, this.tenantId));
      const [copy] = await tx
        .insert(products)
        .values({
          name,
          shortDescription: source.shortDescription,
          longDescription: source.longDescription,
          isPremium: source.isPremium,
          price: source.price,
          uomId: source.uomId,
          categoryId: source.categoryId,
          cost: source.cost,
          minQuantity: source.minQuantity,
          isActive: true,
          sortOrder: (last?.value ?? -1) + 1,
          tenantId: this.tenantId,
        })
        .returning(productColumns(withCost));

      const tiers = await tx
        .select()
        .from(productPriceTiers)
        .where(
          and(eq(productPriceTiers.productId, id), tenantEq(productPriceTiers, this.tenantId)),
        );
      if (tiers.length > 0) {
        await tx.insert(productPriceTiers).values(
          tiers.map((tier) => ({
            productId: copy!.id,
            quantity: tier.quantity,
            price: tier.price,
            sortOrder: tier.sortOrder,
            tenantId: this.tenantId,
          })),
        );
      }

      const groups = await tx
        .select()
        .from(optionGroups)
        .where(and(eq(optionGroups.productId, id), tenantEq(optionGroups, this.tenantId)));
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
            tenantId: this.tenantId,
          })
          .returning({ id: optionGroups.id });
        const groupOptions = await tx
          .select()
          .from(options)
          .where(and(eq(options.optionGroupId, group.id), tenantEq(options, this.tenantId)));
        if (groupOptions.length > 0) {
          await tx.insert(options).values(
            groupOptions.map((option) => ({
              optionGroupId: groupCopy!.id,
              name: option.name,
              description: option.description,
              isActive: option.isActive,
              sortOrder: option.sortOrder,
              tenantId: this.tenantId,
            })),
          );
        }
      }

      return copy!;
    });
  }

  updateProduct(id: string, data: ProductWriteInput, withCost = false) {
    return this.db.transaction(async (tx) => {
      const [product] = await tx
        .update(products)
        .set({
          name: data.name,
          shortDescription: data.shortDescription ?? null,
          longDescription: data.longDescription ?? null,
          isPremium: data.isPremium,
          uomId: data.uomId,
          // Omitted keeps the stored value; an explicit null clears it.
          ...(data.price !== undefined && { price: data.price }),
          ...(data.sku !== undefined && { sku: data.sku }),
          ...(data.cost !== undefined && { cost: data.cost }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.minQuantity !== undefined && { minQuantity: data.minQuantity }),
        })
        .where(and(eq(products.id, id), tenantEq(products, this.tenantId)))
        .returning(productColumns(withCost));
      if (!product) return undefined;
      if (data.tiers) await this.replaceTiers(tx, id, data.tiers);
      return product;
    });
  }

  findTierQuantities(productId: string) {
    return this.db
      .select({ quantity: productPriceTiers.quantity })
      .from(productPriceTiers)
      .where(
        and(eq(productPriceTiers.productId, productId), tenantEq(productPriceTiers, this.tenantId)),
      );
  }

  updateTiers(id: string, tiers: PriceTierInput[], withCost = false) {
    return this.db.transaction(async (tx) => {
      const [product] = await tx
        .select(productColumns(withCost))
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

  setProductActive(id: string, isActive: boolean, withCost = false) {
    return this.db
      .update(products)
      .set({ isActive })
      .where(and(eq(products.id, id), tenantEq(products, this.tenantId)))
      .returning(productColumns(withCost))
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

  isOptionGroupUsed(id: string) {
    return this.db
      .select({ id: quoteLineOptions.id })
      .from(quoteLineOptions)
      .where(and(eq(quoteLineOptions.optionGroupId, id), tenantEq(quoteLineOptions, this.tenantId)))
      .limit(1)
      .then((r) => r.length > 0);
  }

  deleteOptionGroup(id: string) {
    return this.db
      .delete(optionGroups)
      .where(and(eq(optionGroups.id, id), tenantEq(optionGroups, this.tenantId)))
      .returning({ id: optionGroups.id })
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

  isOptionUsed(id: string) {
    return this.db
      .select({ id: quoteLineOptions.id })
      .from(quoteLineOptions)
      .where(and(eq(quoteLineOptions.optionId, id), tenantEq(quoteLineOptions, this.tenantId)))
      .limit(1)
      .then((r) => r.length > 0);
  }

  deleteOption(id: string) {
    return this.db
      .delete(options)
      .where(and(eq(options.id, id), tenantEq(options, this.tenantId)))
      .returning({ id: options.id })
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
