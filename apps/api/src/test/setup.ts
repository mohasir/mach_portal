import { vi } from 'vitest';

// `env.ts` validates process.env at import time; modules under test (e.g. lib/storage)
// import it transitively, so tests run against fixed fake values instead of a real .env.
vi.mock('../env', async () => {
  const { TEST_ENV } = await import('./testEnv');
  return { env: { ...TEST_ENV, DATABASE_URL: 'postgres://test:test@localhost:5432/test' } };
});
