import { TRPCError } from '@trpc/server';
import {
  paginationMeta,
  type ClientsListQuery,
  type CreateClientInput,
  type UpdateClientInput,
} from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { ClientsRepository } from './clients.repository';
import { clientCollectionResource, clientResource } from './clients.resource';

export class ClientsService {
  constructor(private repo: ClientsRepository) {}

  async list(query: ClientsListQuery) {
    const { items, total, paginate, page, pageSize } = await this.repo.findPaginated(query);
    const resource = clientCollectionResource(items);
    if (!paginate) return { items: resource };
    return { items: resource, pagination: paginationMeta(total, page, pageSize) };
  }

  async getById(id: string) {
    const client = await this.repo.findById(id);
    if (!client)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.client.NOT_FOUND) });
    return clientResource(client);
  }

  async create(input: CreateClientInput) {
    const created = await this.repo.create(input);
    return clientResource(created);
  }

  async update(id: string, input: UpdateClientInput) {
    const updated = await this.repo.updateById(id, input);
    if (!updated)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.client.NOT_FOUND) });
    return clientResource(updated);
  }

  async remove(id: string) {
    const deleted = await this.repo.deleteById(id);
    if (!deleted)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.client.NOT_FOUND) });
    return deleted;
  }
}
