import { TRPCError } from '@trpc/server';
import type {
  UpdateCatalogPreferencesInput,
  UpdateQuoteBuilderPreferencesInput,
  UpdateQuoteDefaultsInput,
  UpdateQuoteStagesInput,
  UpdateTaxPreferencesInput,
  UpdateTaxRatesInput,
} from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { ConfigRepository } from './config.repository';
import { configResource } from './config.resource';

export class ConfigService {
  constructor(private repo: ConfigRepository) {}

  async get() {
    const [stateRows, appRow, lastUsedSeq, quoteStageRows] = await Promise.all([
      this.repo.findStateSettings(),
      this.repo.findAppSettings(),
      this.repo.getLastUsedSeq(),
      this.repo.findQuoteStages(),
    ]);
    if (!appRow)
      throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.config.NOT_FOUND) });
    return configResource(stateRows, appRow, lastUsedSeq, quoteStageRows);
  }

  async updateTaxRates(input: UpdateTaxRatesInput) {
    await this.repo.upsertStateSettings(input);
    return this.get();
  }

  async updateTaxPreferences(input: UpdateTaxPreferencesInput) {
    await this.repo.updateTaxPreferences(input);
    return this.get();
  }

  async updateQuoteDefaults(input: UpdateQuoteDefaultsInput) {
    const lastUsedSeq = await this.repo.getLastUsedSeq();
    if (input.quoteSeqStart < lastUsedSeq) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        cause: new AppError(ErrorCodes.config.SEQUENCE_BELOW_LAST),
      });
    }

    await this.repo.updateQuoteDefaults(input);
    return this.get();
  }

  async updateQuoteStages(input: UpdateQuoteStagesInput) {
    await this.repo.upsertQuoteStages(input);
    return this.get();
  }

  async updateCatalogPreferences(input: UpdateCatalogPreferencesInput) {
    await this.repo.updateCatalogPreferences(input);
    return this.get();
  }

  async updateQuoteBuilderPreferences(input: UpdateQuoteBuilderPreferencesInput) {
    await this.repo.updateQuoteBuilderPreferences(input);
    return this.get();
  }
}
