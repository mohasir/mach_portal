import { vi } from 'vitest';

// `env.ts` validates process.env at import time; modules under test (e.g. lib/storage)
// import it transitively, so tests run against fixed fake values instead of a real .env.
vi.mock('../env', () => ({
  env: {
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    BETTER_AUTH_SECRET: 'test-secret-test-secret',
    BETTER_AUTH_URL: 'http://localhost:8080',
    WEB_ORIGIN: ['http://localhost:3000'],
    WEB_APP_URL: 'http://localhost:3000',
    PORT: 8080,
    STORAGE_PROVIDER: 'r2',
    R2_ACCOUNT_ID: 'test',
    R2_ACCESS_KEY_ID: 'test',
    R2_SECRET_ACCESS_KEY: 'test',
    R2_BUCKET_NAME: 'test',
    R2_PUBLIC_URL: 'http://localhost/r2',
    PDF_SERVICE_URL: 'http://localhost/pdf',
    PDF_SERVICE_API_KEY: 'test',
  },
}));
