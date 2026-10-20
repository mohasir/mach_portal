import { vi } from 'vitest';

// Same approach as setup.ts, but pointing at the disposable integration database.
vi.mock('../env', () => ({
  env: {
    DATABASE_URL: process.env['TEST_DATABASE_URL'],
    BETTER_AUTH_SECRET: 'test-secret-test-secret',
    BETTER_AUTH_URL: 'http://localhost:8080',
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
    APP_BASE_DOMAIN: 'localhost',
    APP_PROTOCOL: 'http',
    INTERNAL_PROXY_KEY: 'test-internal-proxy-key',
  },
}));
