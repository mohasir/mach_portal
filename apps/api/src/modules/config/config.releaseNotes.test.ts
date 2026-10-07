import { describe, expect, it, vi } from 'vitest';
import { ACTIONS, RESOURCES, ROLES, hasPermission } from '@repo/guards';
import type { ConfigRepository } from './config.repository';
import { ConfigService } from './config.service';

describe('release notes feature flag permissions', () => {
  it('only superadmin can see and change the release notes flag', () => {
    const view = { [RESOURCES.RELEASE_NOTES_PREFERENCES]: [ACTIONS.VIEW] };
    const update = { [RESOURCES.RELEASE_NOTES_PREFERENCES]: [ACTIONS.UPDATE] };
    expect(hasPermission(ROLES.SUPERADMIN, view)).toBe(true);
    expect(hasPermission(ROLES.SUPERADMIN, update)).toBe(true);
    for (const role of [ROLES.ADMIN, ROLES.OPERATOR]) {
      expect(hasPermission(role, view)).toBe(false);
      expect(hasPermission(role, update)).toBe(false);
    }
  });
});

describe('ConfigService.updateReleaseNotesPreferences', () => {
  it('saves the flag and returns the refreshed config', async () => {
    const repo = {
      updateReleaseNotesPreferences: vi.fn().mockResolvedValue(undefined),
      findStateSettings: vi.fn().mockResolvedValue([]),
      findAppSettings: vi.fn().mockResolvedValue({ showReleaseNotes: true }),
      getLastUsedSeq: vi.fn().mockResolvedValue(0),
      findQuoteStages: vi.fn().mockResolvedValue([]),
    };
    const service = new ConfigService(repo as unknown as ConfigRepository);

    const result = await service.updateReleaseNotesPreferences({ showReleaseNotes: true });

    expect(repo.updateReleaseNotesPreferences).toHaveBeenCalledWith({ showReleaseNotes: true });
    expect(result.appSettings.showReleaseNotes).toBe(true);
  });
});
