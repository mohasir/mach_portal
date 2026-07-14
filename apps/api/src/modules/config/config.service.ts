import { TRPCError } from '@trpc/server';
import type { UpdateConfigInput } from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { ConfigRepository } from './config.repository';
import { configResource } from './config.resource';

export class ConfigService {
  constructor(private repo: ConfigRepository) {}

  async get() {
    const [stateRows, appRow, lastUsedSeq] = await Promise.all([
      this.repo.findStateSettings(),
      this.repo.findAppSettings(),
      this.repo.getLastUsedSeq(),
    ]);
    if (!appRow)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.config.NOT_FOUND) });
    return configResource(stateRows, appRow, lastUsedSeq);
  }

  async update(input: UpdateConfigInput) {
    const lastUsedSeq = await this.repo.getLastUsedSeq();
    if (input.appSettings.quoteSeqStart < lastUsedSeq) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.config.SEQUENCE_BELOW_LAST),
      });
    }

    await this.repo.upsertStateSettings(input.stateSettings);
    await this.repo.upsertAppSettings(input.appSettings);
    return this.get();
  }
}
