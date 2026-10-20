import { afterEach, describe, expect, it } from 'vitest';
import { env } from '../../../env';
import { tenantUrl } from '../tenantUrl';

const original = { protocol: env.APP_PROTOCOL, domain: env.APP_BASE_DOMAIN };

afterEach(() => {
  env.APP_PROTOCOL = original.protocol;
  env.APP_BASE_DOMAIN = original.domain;
});

describe('tenantUrl', () => {
  it('builds an https url with the default path', () => {
    env.APP_PROTOCOL = 'https';
    env.APP_BASE_DOMAIN = 'oravitech.test';
    expect(tenantUrl('acme')).toBe('https://acme.oravitech.test/');
  });

  it('builds an http url with a port and custom path', () => {
    env.APP_PROTOCOL = 'http';
    env.APP_BASE_DOMAIN = 'localhost:3000';
    expect(tenantUrl('acme', '/login')).toBe('http://acme.localhost:3000/login');
  });
});
