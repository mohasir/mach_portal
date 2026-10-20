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
