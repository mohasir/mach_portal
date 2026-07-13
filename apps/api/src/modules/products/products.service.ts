import { TRPCError } from '@trpc/server';
import type {
  CreateOptionGroupInput,
  CreateOptionInput,
  CreateProductInput,
  UpdateOptionGroupInput,
  UpdateOptionInput,
  UpdateProductInput,
} from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { ProductsRepository } from './products.repository';
import { buildProductTree, optionGroupResource, optionResource, productResource } from './products.resource';

export class ProductsService {
  constructor(private repo: ProductsRepository) {}

  async list() {
    const { productRows, groupRows, optionRows } = await this.repo.findTree(false);
    return buildProductTree(productRows, groupRows, optionRows);
  }

  async catalog(includeInactive: boolean) {
    const { productRows, groupRows, optionRows } = await this.repo.findTree(includeInactive);
    return buildProductTree(productRows, groupRows, optionRows);
  }

  // ── product ──
  async createProduct(input: CreateProductInput) {
    const existing = await this.repo.findProductByName(input.name);
    if (existing) throw new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.product.ALREADY_EXISTS) });
    return productResource(await this.repo.createProduct(input));
  }

  async updateProduct(id: string, input: UpdateProductInput) {
    const updated = await this.repo.updateProduct(id, input);
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
    return productResource(updated);
  }

  async toggleProductActive(id: string, isActive: boolean) {
    const updated = await this.repo.setProductActive(id, isActive);
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.product.NOT_FOUND) });
    return productResource(updated);
  }

  async reorderProducts(ids: string[]) {
    await this.repo.reorderProducts(ids);
    return { success: true } as const;
  }

  // ── option_group ──
  async createOptionGroup(input: CreateOptionGroupInput) {
    return optionGroupResource(await this.repo.createOptionGroup(input));
  }

  async updateOptionGroup(id: string, input: UpdateOptionGroupInput) {
    const updated = await this.repo.updateOptionGroup(id, input);
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.optionGroup.NOT_FOUND) });
    return optionGroupResource(updated);
  }

  async toggleOptionGroupActive(id: string, isActive: boolean) {
    const updated = await this.repo.setOptionGroupActive(id, isActive);
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.optionGroup.NOT_FOUND) });
    return optionGroupResource(updated);
  }

  async reorderOptionGroups(ids: string[]) {
    await this.repo.reorderOptionGroups(ids);
    return { success: true } as const;
  }

  // ── option ──
  async createOption(input: CreateOptionInput) {
    return optionResource(await this.repo.createOption(input));
  }

  async updateOption(id: string, input: UpdateOptionInput) {
    const updated = await this.repo.updateOption(id, input);
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.option.NOT_FOUND) });
    return optionResource(updated);
  }

  async toggleOptionActive(id: string, isActive: boolean) {
    const updated = await this.repo.setOptionActive(id, isActive);
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.option.NOT_FOUND) });
    return optionResource(updated);
  }

  async reorderOptions(ids: string[]) {
    await this.repo.reorderOptions(ids);
    return { success: true } as const;
  }
}
