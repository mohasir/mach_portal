import { beforeEach, vi } from 'vitest';
import { clearFeatureCache } from '../lib/features/cache';

// Same approach as setup.ts, but pointing at the disposable integration database.
vi.mock('../env', async () => {
  const { TEST_ENV } = await import('./testEnv');
  return { env: { ...TEST_ENV, DATABASE_APP_URL: process.env['TEST_DATABASE_URL'] } };
});

// The feature cache is per process and outlives a test: a stale entry would leak one test's
// features into the next.
beforeEach(() => clearFeatureCache());
