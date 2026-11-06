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
import { ProductsRepository } from './products.repository';
import {
  buildPricesList,
  buildProductTree,
  optionGroupResource,
  optionResource,
  productResource,
  productWithTiersResource,
  withCatalogUsage,
} from './products.resource';

export class ProductsService {
  constructor(private repo: ProductsRepository) {}

  async list() {
    const { productRows, tierRows, groupRows, optionRows } = await this.repo.findTree(false);
    return buildProductTree(productRows, tierRows, groupRows, optionRows);
  }

  async catalog(includeInactive: boolean) {
    const [{ productRows, tierRows, groupRows, optionRows }, usage] = await Promise.all([
      this.repo.findTree(includeInactive),
      this.repo.findUsage(),
    ]);
    return withCatalogUsage(buildProductTree(productRows, tierRows, groupRows, optionRows), usage);
  }

  async pricesList() {
    const { productRows, tierRows } = await this.repo.findPricesTree();
    return buildPricesList(productRows, tierRows);
  }

  async updateProductTiers(id: string, tiers: PriceTierInput[]) {
    const result = await this.repo.updateTiers(id, tiers);
    if (!result)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
    return productWithTiersResource(result.product, result.tierRows);
  }

  // ── product ──
  async createProduct(input: CreateProductInput) {
    const existing = await this.repo.findProductByName(input.name);
    if (existing)
      throw new TRPCError({
        code: 'CONFLICT',
        cause: new AppError(ErrorCodes.product.ALREADY_EXISTS),
      });
    return productResource(await this.repo.createProduct(input));
  }

  async duplicateProduct(id: string) {
    const source = await this.repo.findProductById(id);
    if (!source)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });

    let name = `${source.name} (copia)`;
    for (let n = 2; await this.repo.findProductByName(name); n++) {
      name = `${source.name} (copia ${n})`;
    }

    const copy = await this.repo.duplicateProduct(id, name).catch((error: unknown) => {
      if (isPgError(error, PG_UNIQUE_VIOLATION, 'products_tenant_name')) {
        throw new TRPCError({
          code: 'CONFLICT',
          cause: new AppError(ErrorCodes.product.ALREADY_EXISTS),
        });
      }
      throw error;
    });
    if (!copy)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
    return productResource(copy);
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    const updated = await this.repo.updateProduct(id, input).catch((error: unknown) => {
      if (isPgError(error, PG_UNIQUE_VIOLATION, 'products_tenant_name')) {
        throw new TRPCError({
          code: 'CONFLICT',
          cause: new AppError(ErrorCodes.product.ALREADY_EXISTS),
        });
      }
      throw error;
    });
    if (!updated)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
    return productResource(updated);
  }

  async toggleProductActive(id: string, isActive: boolean) {
    const updated = await this.repo.setProductActive(id, isActive);
    if (!updated)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
    return productResource(updated);
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
