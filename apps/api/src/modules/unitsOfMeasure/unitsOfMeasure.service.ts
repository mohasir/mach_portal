import { TRPCError } from '@trpc/server';
import {
  isPositiveDecimal,
  normalizeDecimal,
  paginationMeta,
  type CreateUnitInput,
  type UnitsOfMeasureListQuery,
  type UpdateUnitInput,
} from '@repo/schemas';
import { AppError, ErrorCodes, isPgError, PG_UNIQUE_VIOLATION } from '../../lib/errors';
import { UnitsOfMeasureRepository } from './unitsOfMeasure.repository';
import { unitCollectionResource, unitResource } from './unitsOfMeasure.resource';

const notFound = () =>
  new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.unit.NOT_FOUND) });
const codeTaken = () =>
  new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.unit.CODE_TAKEN) });
const inUse = () =>
  new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.unit.IN_USE) });
const invalidFactor = () =>
  new TRPCError({ code: 'BAD_REQUEST', cause: new AppError(ErrorCodes.unit.INVALID_FACTOR) });
const systemImmutable = () =>
  new TRPCError({ code: 'BAD_REQUEST', cause: new AppError(ErrorCodes.unit.SYSTEM_IMMUTABLE) });

// A concurrent request can take the code between the lookup and the write; the unique
// constraint then rejects it.
const rethrowCodeTaken = (error: unknown): never => {
  if (isPgError(error, PG_UNIQUE_VIOLATION, 'units_of_measure_tenant_code')) throw codeTaken();
  throw error;
};

export class UnitsOfMeasureService {
  constructor(private repo: UnitsOfMeasureRepository) {}

  async list(query: UnitsOfMeasureListQuery) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(query);
    const resource = unitCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async options() {
    return unitCollectionResource(await this.repo.findActive());
  }

  async create(input: CreateUnitInput) {
    if (!isPositiveDecimal(input.factor)) throw invalidFactor();
    if (await this.repo.findByCode(input.code)) throw codeTaken();
    return unitResource(await this.repo.create(input).catch(rethrowCodeTaken));
  }

  async update(id: string, input: UpdateUnitInput) {
    const current = await this.repo.findById(id);
    if (!current) throw notFound();

    const factor = normalizeDecimal(input.factor);
    if (!isPositiveDecimal(input.factor) || (current.isBase && factor !== '1')) {
      throw invalidFactor();
    }

    const changesDimension = input.dimension !== current.dimension;
    const changesFactor = factor !== normalizeDecimal(current.factor);
    // The seed recognizes system units by code, so the code stays as well.
    if (current.isSystem && (changesDimension || changesFactor || input.code !== current.code)) {
      throw systemImmutable();
    }
    if ((changesDimension || changesFactor) && (await this.repo.isUsed(id))) throw inUse();
    if (await this.repo.findByCode(input.code, id)) throw codeTaken();

    const updated = await this.repo.updateById(id, input).catch(rethrowCodeTaken);
    if (!updated) throw notFound();
    return unitResource(updated);
  }

  async disable(id: string) {
    if (!(await this.repo.findById(id))) throw notFound();
    if (await this.repo.blocksDeactivation(id)) throw inUse();
    return this.setActive(id, false);
  }

  async enable(id: string) {
    return this.setActive(id, true);
  }

  private async setActive(id: string, isActive: boolean) {
    const updated = await this.repo.setActive(id, isActive);
    if (!updated) throw notFound();
    return unitResource(updated);
  }
}
