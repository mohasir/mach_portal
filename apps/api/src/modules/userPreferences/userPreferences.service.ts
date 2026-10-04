import type { UpdateUserPreferencesInput } from '@repo/schemas';
import { UserPreferencesRepository } from './userPreferences.repository';
import { userPreferencesResource } from './userPreferences.resource';

export class UserPreferencesService {
  constructor(private repo: UserPreferencesRepository) {}

  async get(userId: string) {
    const row = await this.repo.findByUserId(userId);
    return userPreferencesResource(row);
  }

  async update(userId: string, input: UpdateUserPreferencesInput) {
    const row = await this.repo.merge(userId, input);
    return userPreferencesResource(row);
  }
}
