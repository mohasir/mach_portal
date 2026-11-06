import { vi } from 'vitest';

// Same approach as setup.ts, but pointing at the disposable integration database.
vi.mock('../env', async () => {
  const { TEST_ENV } = await import('./testEnv');
  return { env: { ...TEST_ENV, DATABASE_URL: process.env['TEST_DATABASE_URL'] } };
});
