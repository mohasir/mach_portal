import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductsRepository } from '../products.repository';
import { ProductsService } from '../products.service';

const unit = {
  id: 'u1',
  name: 'Persona',
  pluralName: 'Personas',
  code: 'pers',
  dimension: 'quantity' as const,
  isActive: true,
};

const copy = {
  id: 'new-id',
  name: 'Barra (copia)',
  description: null,
  isPremium: false,
  isActive: true,
  sortOrder: 3,
  price: null,
  uomId: 'u1',
  categoryId: null,
  sku: null,
  minQuantity: 1,
};

function makeRepo() {
  return {
    isOptionUsed: vi.fn().mockResolvedValue(false),
    deleteOption: vi.fn().mockResolvedValue({ id: 'opt-1' }),
    isOptionGroupUsed: vi.fn().mockResolvedValue(false),
    deleteOptionGroup: vi.fn().mockResolvedValue({ id: 'grp-1' }),
    findProductById: vi.fn().mockResolvedValue({ id: 'id-1', name: 'Barra' }),
    findProductByName: vi.fn().mockResolvedValue(undefined),
    duplicateProduct: vi.fn().mockResolvedValue(copy),
    findTierQuantities: vi.fn().mockResolvedValue([]),
    findUnit: vi.fn().mockResolvedValue(unit),
  };
}

describe('ProductsService.duplicateProduct', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ProductsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new ProductsService(repo as unknown as ProductsRepository, true);
  });

  it('names the copy after the source with a "copia" suffix', async () => {
    await expect(service.duplicateProduct('id-1')).resolves.toMatchObject({ id: 'new-id' });
    expect(repo.duplicateProduct).toHaveBeenCalledWith('id-1', 'Barra (copia)', false);
  });

  it('increments the suffix while the name is taken', async () => {
    repo.findProductByName
      .mockResolvedValueOnce({ id: 'a' })
      .mockResolvedValueOnce({ id: 'b' })
      .mockResolvedValueOnce(undefined);
    await service.duplicateProduct('id-1');
    expect(repo.duplicateProduct).toHaveBeenCalledWith('id-1', 'Barra (copia 3)', false);
  });

  it('rejects an unknown product', async () => {
    repo.findProductById.mockResolvedValue(undefined);
    await expect(service.duplicateProduct('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      cause: { code: 'PRODUCT_NOT_FOUND' },
    });
    expect(repo.duplicateProduct).not.toHaveBeenCalled();
  });
});

describe('ProductsService permanent delete', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ProductsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new ProductsService(repo as unknown as ProductsRepository, true);
  });

  it('deletes an option that no quote used', async () => {
    await expect(service.deleteOption('opt-1')).resolves.toEqual({ id: 'opt-1' });
  });

  it('rejects deleting an option already used in a quote', async () => {
    repo.isOptionUsed.mockResolvedValue(true);
    await expect(service.deleteOption('opt-1')).rejects.toMatchObject({
      code: 'CONFLICT',
      cause: { code: 'OPTION_IN_USE' },
    });
    expect(repo.deleteOption).not.toHaveBeenCalled();
  });

  it('maps a foreign key violation raised during the delete to IN_USE', async () => {
    repo.deleteOption.mockRejectedValue({ cause: { code: '23503' } });
    await expect(service.deleteOption('opt-1')).rejects.toMatchObject({
      code: 'CONFLICT',
      cause: { code: 'OPTION_IN_USE' },
    });
  });

  it('maps a foreign key violation on a group delete to IN_USE', async () => {
    repo.deleteOptionGroup.mockRejectedValue({ code: '23503' });
    await expect(service.deleteOptionGroup('grp-1')).rejects.toMatchObject({
      code: 'CONFLICT',
      cause: { code: 'OPTION_GROUP_IN_USE' },
    });
  });

  it('rejects deleting an unknown option', async () => {
    repo.deleteOption.mockResolvedValue(undefined);
    await expect(service.deleteOption('nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      cause: { code: 'OPTION_NOT_FOUND' },
    });
  });

  it('deletes a group that no quote used', async () => {
    await expect(service.deleteOptionGroup('grp-1')).resolves.toEqual({ id: 'grp-1' });
  });

  it('rejects deleting a group already used in a quote', async () => {
    repo.isOptionGroupUsed.mockResolvedValue(true);
    await expect(service.deleteOptionGroup('grp-1')).rejects.toMatchObject({
      code: 'CONFLICT',
      cause: { code: 'OPTION_GROUP_IN_USE' },
    });
    expect(repo.deleteOptionGroup).not.toHaveBeenCalled();
  });
});

describe('ProductsService price and quotable', () => {
  const row = {
    id: 'p1',
    name: 'Barra',
    description: null,
    isPremium: false,
    isActive: true,
    sortOrder: 0,
    price: null as number | null,
    uomId: 'u1',
    categoryId: null,
    sku: null,
    minQuantity: 1,
  };
  const tier = { id: 't1', productId: 'p1', quantity: 30, price: 1000, sortOrder: 0 };
  const emptyTree = {
    groupRows: [],
    optionRows: [],
    lookups: { units: new Map([['u1', unit]]), categories: new Map() },
  };

  it('exposes price and quotable on the catalog, keeping stored tiers with the add-on off', async () => {
    const repo = {
      findTree: vi.fn().mockResolvedValue({
        productRows: [
          { ...row, id: 'p1' },
          { ...row, id: 'p2', price: 5 },
          { ...row, id: 'p3' },
        ],
        tierRows: [tier, { ...tier, id: 't2', productId: 'p3' }],
        ...emptyTree,
      }),
      findUsage: vi.fn().mockResolvedValue({ optionIds: new Set(), groupIds: new Set() }),
    };
    const off = await new ProductsService(repo as unknown as ProductsRepository, false).catalog(
      true,
    );
    expect(off.map((p) => [p.price, p.quotable])).toEqual([
      [null, false],
      [5, true],
      [null, false],
    ]);
    expect(off[0]!.priceTiers).toHaveLength(1);

    const on = await new ProductsService(repo as unknown as ProductsRepository, true).catalog(true);
    expect(on.map((p) => p.quotable)).toEqual([true, true, true]);
  });

  it('computes quotable on a written product from its stored tiers', async () => {
    const repo = {
      findProductByName: vi.fn().mockResolvedValue(undefined),
      createProduct: vi.fn().mockResolvedValue(row),
      findTierQuantities: vi.fn().mockResolvedValue([{ quantity: 1 }, { quantity: 2 }]),
      findUnit: vi.fn().mockResolvedValue(unit),
    };
    const input = { name: 'Barra', isPremium: false, tiers: [], uomId: 'u1' };
    const withTiers = new ProductsService(repo as unknown as ProductsRepository, true);
    await expect(withTiers.createProduct(input)).resolves.toMatchObject({
      price: null,
      quotable: true,
    });
    const without = new ProductsService(repo as unknown as ProductsRepository, false);
    await expect(without.createProduct(input)).resolves.toMatchObject({ quotable: false });
  });
});
