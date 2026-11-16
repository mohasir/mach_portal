import { TRPCError } from '@trpc/server';
import type {
  CreateOptionGroupInput,
  CreateOptionInput,
  CreateProductInput,
  PriceTierInput,
  UpdateOptionGroupInput,
  UpdateOptionInput,
  UpdateProductInput,
} from '@repo/schemas';
import {
  AppError,
  ErrorCodes,
  isPgError,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '../../lib/errors';
import { featureNotEnabled } from '../../core/trpc/requireFeature';
import { isQuotable } from './products.pricing';
import { ProductsRepository, type ProductWriteInput } from './products.repository';
import {
  buildPricesList,
  buildProductTree,
  optionGroupResource,
  optionResource,
  productResource,
  type PublicProduct,
  productWithTiersResource,
  withCatalogUsage,
} from './products.resource';

// What the caller may do with the internal cost (product_cost.read / product_cost.update).
export type CostAccess = { read: boolean; update: boolean };
const NO_COST_ACCESS: CostAccess = { read: false, update: false };

const unitNotFound = () =>
  new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.unit.NOT_FOUND) });
const categoryNotFound = () =>
  new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.productCategory.NOT_FOUND) });
const productNotFound = () =>
  new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
const skuTaken = () =>
  new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.product.SKU_TAKEN) });
const costForbidden = () =>
  new TRPCError({ code: 'FORBIDDEN', cause: new AppError(ErrorCodes.product.COST_FORBIDDEN) });

// A concurrent request can take the name or the SKU between the lookup and the write; the unique
// constraints then reject it.
const rethrowUniqueViolation = (error: unknown): never => {
  if (isPgError(error, PG_UNIQUE_VIOLATION, 'products_tenant_name')) {
    throw new TRPCError({
      code: 'CONFLICT',
      cause: new AppError(ErrorCodes.product.ALREADY_EXISTS),
    });
  }
  if (isPgError(error, PG_UNIQUE_VIOLATION, 'products_tenant_sku')) throw skuTaken();
  throw error;
};

export class ProductsService {
  constructor(
    private repo: ProductsRepository,
    private priceTiersActive: boolean,
    private cost: CostAccess = NO_COST_ACCESS,
  ) {}

  private get visibility() {
    return { canSeeCost: this.cost.read };
  }

  // Checked before anything is written: an explicit null also writes the cost.
  private assertCostWritable(input: { cost?: number | null }) {
    if (input.cost !== undefined && !this.cost.update) throw costForbidden();
  }

  // Without the add-on no tiers can be written and the stored ones are kept: an empty `tiers` (the
  // schema default) must not delete them.
  private withTiersRule(input: CreateProductInput | UpdateProductInput): ProductWriteInput {
    if (this.priceTiersActive) return input;
    if (input.tiers.length > 0) throw featureNotEnabled('priceTiers');
    const { tiers: _ignored, ...rest } = input;
    return rest;
  }

  // Written rows carry no tiers; they only matter when the price alone does not decide.
  private async withQuotable(row: PublicProduct) {
    const [tiers, unit, category] = await Promise.all([
      row.price == null && this.priceTiersActive ? this.repo.findTierQuantities(row.id) : [],
      this.repo.findUnit(row.uomId),
      row.categoryId ? this.repo.findCategory(row.categoryId) : null,
    ]);
    if (!unit) throw unitNotFound();
    return productResource(
      row,
      {
        quotable: isQuotable(row, tiers, this.priceTiersActive),
        unit,
        category: category ?? null,
      },
      this.visibility,
    );
  }

  // Same rule as the unit: resolved inside the tenant, active unless the product already has it.
  private async assertCategory(categoryId: string | null | undefined, currentId?: string | null) {
    if (!categoryId) return;
    const category = await this.repo.findCategory(categoryId);
    if (!category || (!category.isActive && categoryId !== currentId)) throw categoryNotFound();
  }

  private async assertSkuFree(sku: string | null | undefined, productId?: string) {
    if (sku && (await this.repo.findProductBySku(sku, productId))) throw skuTaken();
  }

  // The unit is resolved inside the tenant (a foreign key would accept another tenant's id) and
  // must be active, unless the product already uses it.
  private async assertUnit(uomId: string, currentUomId?: string) {
    const unit = await this.repo.findUnit(uomId);
    if (!unit || (!unit.isActive && uomId !== currentUomId)) throw unitNotFound();
  }

  async list() {
    const { productRows, tierRows, groupRows, optionRows, lookups } = await this.repo.findTree(
      false,
      this.cost.read,
    );
    return buildProductTree(
      productRows,
      tierRows,
      groupRows,
      optionRows,
      this.priceTiersActive,
      lookups,
      this.visibility,
    );
  }

  async catalog(includeInactive: boolean) {
    const [{ productRows, tierRows, groupRows, optionRows, lookups }, usage] = await Promise.all([
      this.repo.findTree(includeInactive, this.cost.read),
      this.repo.findUsage(),
    ]);
    return withCatalogUsage(
      buildProductTree(
        productRows,
        tierRows,
        groupRows,
        optionRows,
        this.priceTiersActive,
        lookups,
        this.visibility,
      ),
      usage,
    );
  }

  async pricesList() {
    const { productRows, tierRows, lookups } = await this.repo.findPricesTree(this.cost.read);
    return buildPricesList(productRows, tierRows, this.priceTiersActive, lookups, this.visibility);
  }

  async updateProductTiers(id: string, tiers: PriceTierInput[]) {
    const result = await this.repo.updateTiers(id, tiers, this.cost.read);
    if (!result) throw productNotFound();
    const { product } = result;
    const [unit, category] = await Promise.all([
      this.repo.findUnit(product.uomId),
      product.categoryId ? this.repo.findCategory(product.categoryId) : null,
    ]);
    if (!unit) throw unitNotFound();
    return productWithTiersResource(
      product,
      result.tierRows,
      this.priceTiersActive,
      {
        units: new Map([[unit.id, unit]]),
        categories: new Map(category ? [[category.id, category]] : []),
      },
      this.visibility,
    );
  }

  // ── product ──
  async createProduct(input: CreateProductInput) {
    this.assertCostWritable(input);
    const data = this.withTiersRule(input);
    await this.assertUnit(input.uomId);
    await this.assertCategory(input.categoryId);
    const existing = await this.repo.findProductByName(input.name);
    if (existing)
      throw new TRPCError({
        code: 'CONFLICT',
        cause: new AppError(ErrorCodes.product.ALREADY_EXISTS),
      });
    await this.assertSkuFree(input.sku);
    const created = await this.repo
      .createProduct(data, this.cost.read)
      .catch(rethrowUniqueViolation);
    return this.withQuotable(created);
  }

  async duplicateProduct(id: string) {
    const source = await this.repo.findProductById(id);
    if (!source)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });

    let name = `${source.name} (copia)`;
    for (let n = 2; await this.repo.findProductByName(name); n++) {
      name = `${source.name} (copia ${n})`;
    }

    const copy = await this.repo
      .duplicateProduct(id, name, this.cost.read)
      .catch(rethrowUniqueViolation);
    if (!copy)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
    return this.withQuotable(copy);
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    this.assertCostWritable(input);
    const current = await this.repo.findProductById(id);
    if (!current) throw productNotFound();
    await this.assertUnit(input.uomId, current.uomId);
    await this.assertCategory(input.categoryId, current.categoryId);
    await this.assertSkuFree(input.sku, id);
    const updated = await this.repo
      .updateProduct(id, this.withTiersRule(input), this.cost.read)
      .catch(rethrowUniqueViolation);
    if (!updated)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
    return this.withQuotable(updated);
  }

  async toggleProductActive(id: string, isActive: boolean) {
    const updated = await this.repo.setProductActive(id, isActive, this.cost.read);
    if (!updated)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
    return this.withQuotable(updated);
  }

  async reorderProducts(ids: string[]) {
    await this.repo.reorderProducts(ids);
    return { success: true } as const;
  }

  // ── option_group ──
  async createOptionGroup(input: CreateOptionGroupInput) {
    const created = await this.repo.createOptionGroup(input);
    if (!created)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
    return optionGroupResource(created);
  }

  async updateOptionGroup(id: string, input: UpdateOptionGroupInput) {
    const updated = await this.repo.updateOptionGroup(id, input);
    if (!updated)
      throw new TRPCError({
        code: 'NOT_FOUND',
        cause: new AppError(ErrorCodes.optionGroup.NOT_FOUND),
      });
    return optionGroupResource(updated);
  }

  // A quote line can reference the row between the in-use check and the DELETE; Postgres then
  // rejects the delete with a foreign key violation.
  async deleteOptionGroup(id: string) {
    if (await this.repo.isOptionGroupUsed(id))
      throw new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.optionGroup.IN_USE) });
    const deleted = await this.repo.deleteOptionGroup(id).catch((error: unknown) => {
      if (isPgError(error, PG_FOREIGN_KEY_VIOLATION))
        throw new TRPCError({
          code: 'CONFLICT',
          cause: new AppError(ErrorCodes.optionGroup.IN_USE),
        });
      throw error;
    });
    if (!deleted)
      throw new TRPCError({
        code: 'NOT_FOUND',
        cause: new AppError(ErrorCodes.optionGroup.NOT_FOUND),
      });
    return deleted;
  }

  async toggleOptionGroupActive(id: string, isActive: boolean) {
    const updated = await this.repo.setOptionGroupActive(id, isActive);
    if (!updated)
      throw new TRPCError({
        code: 'NOT_FOUND',
        cause: new AppError(ErrorCodes.optionGroup.NOT_FOUND),
      });
    return optionGroupResource(updated);
  }

  async reorderOptionGroups(ids: string[]) {
    await this.repo.reorderOptionGroups(ids);
    return { success: true } as const;
  }

  // ── option ──
  async createOption(input: CreateOptionInput) {
    const created = await this.repo.createOption(input);
    if (!created)
      throw new TRPCError({
        code: 'NOT_FOUND',
        cause: new AppError(ErrorCodes.optionGroup.NOT_FOUND),
      });
    return optionResource(created);
  }

  async updateOption(id: string, input: UpdateOptionInput) {
    const updated = await this.repo.updateOption(id, input);
    if (!updated)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.option.NOT_FOUND) });
    return optionResource(updated);
  }

  async deleteOption(id: string) {
    if (await this.repo.isOptionUsed(id))
      throw new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.option.IN_USE) });
    const deleted = await this.repo.deleteOption(id).catch((error: unknown) => {
      if (isPgError(error, PG_FOREIGN_KEY_VIOLATION))
        throw new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.option.IN_USE) });
      throw error;
    });
    if (!deleted)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.option.NOT_FOUND) });
    return deleted;
  }

  async toggleOptionActive(id: string, isActive: boolean) {
    const updated = await this.repo.setOptionActive(id, isActive);
    if (!updated)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.option.NOT_FOUND) });
    return optionResource(updated);
  }

  async reorderOptions(ids: string[]) {
    await this.repo.reorderOptions(ids);
    return { success: true } as const;
  }
}
