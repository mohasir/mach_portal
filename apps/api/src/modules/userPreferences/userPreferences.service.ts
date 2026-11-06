import type { UpdateUserPreferencesInput } from '@repo/schemas';
import { UserPreferencesRepository } from './userPreferences.repository';
import { userPreferencesResource } from './userPreferences.resource';

// Bound to one user at construction: the module passes the session user, so no caller can
// read or write someone else's row.
export class UserPreferencesService {
  constructor(
    private repo: UserPreferencesRepository,
    private userId: string,
  ) {}

  async get() {
    const row = await this.repo.findByUserId(this.userId);
    return userPreferencesResource(row);
  }

  async update(input: UpdateUserPreferencesInput) {
    const row = await this.repo.merge(this.userId, input);
    return userPreferencesResource(row);
  }
}
