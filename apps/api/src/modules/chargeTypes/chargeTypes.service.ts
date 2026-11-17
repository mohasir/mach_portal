import { TRPCError } from '@trpc/server';
import {
  isValidChargeValue,
  normalizeChargeValue,
  paginationMeta,
  type ChargeTypesListQuery,
  type CreateChargeTypeInput,
  type UpdateChargeTypeInput,
} from '@repo/schemas';
import { AppError, ErrorCodes, isPgError, PG_UNIQUE_VIOLATION } from '../../lib/errors';
import { ChargeTypesRepository } from './chargeTypes.repository';
import { chargeTypeCollectionResource, chargeTypeResource } from './chargeTypes.resource';

const notFound = () =>
  new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.chargeType.NOT_FOUND) });
const nameTaken = () =>
  new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.chargeType.NAME_TAKEN) });
export const invalidChargeValue = () =>
  new TRPCError({
    code: 'BAD_REQUEST',
    cause: new AppError(ErrorCodes.chargeType.INVALID_VALUE),
  });

// A concurrent request can take the name between the lookup and the write; the unique index then
// rejects it.
const rethrowNameTaken = (error: unknown): never => {
  if (isPgError(error, PG_UNIQUE_VIOLATION, 'charge_types_tenant_name')) throw nameTaken();
  throw error;
};

// The schema already checks the value, but the service is the boundary for callers that skip it.
function validated<T extends CreateChargeTypeInput>(input: T): T {
  if (!isValidChargeValue(input.kind, input.defaultValue)) throw invalidChargeValue();
  return { ...input, defaultValue: normalizeChargeValue(input.kind, input.defaultValue) };
}

export class ChargeTypesService {
  constructor(private repo: ChargeTypesRepository) {}

  async list(query: ChargeTypesListQuery) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(query);
    const resource = chargeTypeCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async options() {
    return chargeTypeCollectionResource(await this.repo.findActive());
  }

  async create(input: CreateChargeTypeInput) {
    const data = validated(input);
    if (await this.repo.findByName(data.name)) throw nameTaken();
    return chargeTypeResource(await this.repo.create(data).catch(rethrowNameTaken));
  }

  async update(id: string, input: UpdateChargeTypeInput) {
    if (!(await this.repo.findById(id))) throw notFound();
    const data = validated(input);
    if (await this.repo.findByName(data.name, id)) throw nameTaken();
    const updated = await this.repo.updateById(id, data).catch(rethrowNameTaken);
    if (!updated) throw notFound();
    return chargeTypeResource(updated);
  }

  async disable(id: string) {
    return this.setActive(id, false);
  }

  async enable(id: string) {
    return this.setActive(id, true);
  }

  private async setActive(id: string, isActive: boolean) {
    const updated = await this.repo.setActive(id, isActive);
    if (!updated) throw notFound();
    return chargeTypeResource(updated);
  }
}
