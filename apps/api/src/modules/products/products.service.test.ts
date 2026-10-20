import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

const copy = {
  id: 'new-id',
  name: 'Barra (copia)',
  description: null,
  isPremium: false,
  isActive: true,
  sortOrder: 3,
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
  };
}

describe('ProductsService.duplicateProduct', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ProductsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new ProductsService(repo as unknown as ProductsRepository);
  });

  it('names the copy after the source with a "copia" suffix', async () => {
    await expect(service.duplicateProduct('id-1')).resolves.toMatchObject({ id: 'new-id' });
    expect(repo.duplicateProduct).toHaveBeenCalledWith('id-1', 'Barra (copia)');
  });

  it('increments the suffix while the name is taken', async () => {
    repo.findProductByName
      .mockResolvedValueOnce({ id: 'a' })
      .mockResolvedValueOnce({ id: 'b' })
      .mockResolvedValueOnce(undefined);
    await service.duplicateProduct('id-1');
    expect(repo.duplicateProduct).toHaveBeenCalledWith('id-1', 'Barra (copia 3)');
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
    service = new ProductsService(repo as unknown as ProductsRepository);
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
