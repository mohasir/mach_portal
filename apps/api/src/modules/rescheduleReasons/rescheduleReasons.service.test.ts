import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RescheduleReasonsRepository } from './rescheduleReasons.repository';
import { RescheduleReasonsService } from './rescheduleReasons.service';

const reason = { id: 'id-1', name: 'Clima', requiresNote: false, isActive: true, sortOrder: 0 };

function makeRepo() {
  return {
    findPaginated: vi.fn(),
    findByName: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue(reason),
    updateById: vi.fn().mockResolvedValue(reason),
    setActive: vi.fn().mockResolvedValue(reason),
  };
}

describe('RescheduleReasonsService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: RescheduleReasonsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new RescheduleReasonsService(repo as unknown as RescheduleReasonsRepository);
  });

  it('create rejects a duplicated name', async () => {
    repo.findByName.mockResolvedValue({ id: 'other' });
    await expect(service.create({ name: 'Clima', requiresNote: false })).rejects.toMatchObject({
      code: 'CONFLICT',
      cause: { code: 'RESCHEDULE_REASON_NAME_TAKEN' },
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('create returns the new reason', async () => {
    await expect(service.create({ name: 'Clima', requiresNote: false })).resolves.toEqual(reason);
  });

  it('update checks duplicates excluding its own id', async () => {
    await service.update('id-1', { name: 'Clima', requiresNote: true });
    expect(repo.findByName).toHaveBeenCalledWith('Clima', 'id-1');
    expect(repo.updateById).toHaveBeenCalledWith('id-1', { name: 'Clima', requiresNote: true });
  });

  it('update rejects a name used by another reason', async () => {
    repo.findByName.mockResolvedValue({ id: 'other' });
    await expect(
      service.update('id-1', { name: 'Clima', requiresNote: false }),
    ).rejects.toMatchObject({ code: 'CONFLICT', cause: { code: 'RESCHEDULE_REASON_NAME_TAKEN' } });
  });

  it('update on a missing id is NOT_FOUND', async () => {
    repo.updateById.mockResolvedValue(undefined);
    await expect(
      service.update('missing', { name: 'Clima', requiresNote: false }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', cause: { code: 'RESCHEDULE_REASON_NOT_FOUND' } });
  });

  it('toggleActive on a missing id is NOT_FOUND', async () => {
    repo.setActive.mockResolvedValue(undefined);
    await expect(service.toggleActive('missing', false)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      cause: { code: 'RESCHEDULE_REASON_NOT_FOUND' },
    });
  });

  it('list without page/pageSize returns items without pagination', async () => {
    repo.findPaginated.mockResolvedValue({
      items: [reason],
      total: 1,
      paginate: false,
      page: 1,
      pageSize: 100,
    });
    const result = await service.list({ sortBy: 'sortOrder', sortDir: 'asc', isActive: true });
    expect(result).toEqual({ items: [reason] });
  });

  it('list with page/pageSize returns pagination meta', async () => {
    repo.findPaginated.mockResolvedValue({
      items: [reason],
      total: 1,
      paginate: true,
      page: 1,
      pageSize: 10,
    });
    const result = await service.list({ page: 1, pageSize: 10, sortBy: 'name', sortDir: 'asc' });
    expect(result).toMatchObject({ items: [reason], pagination: { total: 1, page: 1 } });
  });
});
