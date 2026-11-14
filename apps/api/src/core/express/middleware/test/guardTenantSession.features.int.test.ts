import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ACTIONS, RESOURCES, type FeatureKey, type PermissionCheck } from '@repo/guards';
import { loadTenantFeatures } from '../../../../lib/features/repository';
import { createUserWithPassword, signInCookie } from '../../../../test/authHelpers';
import { addMember, createTestTenant, resetDb } from '../../../../test/db';
import { guardTenantSession } from '../guardTenantSession';

vi.mock('../../../../lib/features/repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../lib/features/repository')>();
  return { ...actual, loadTenantFeatures: vi.fn(actual.loadTenantFeatures) };
});

const UPLOAD: PermissionCheck = { [RESOURCES.PAYMENT]: [ACTIONS.UPLOAD_ATTACHMENT] };

type Call = { status: number | null; body: unknown; next: Mock<NextFunction> };

async function run(cookie: string, method = 'POST'): Promise<Call> {
  const out: Call = { status: null, body: undefined, next: vi.fn<NextFunction>() };
  const res = {
    locals: {},
    status(code: number) {
      out.status = code;
      return this;
    },
    json(body: unknown) {
      out.body = body;
      return this;
    },
  } as unknown as Response;
  const request = {
    headers: { cookie },
    method,
    baseUrl: '/api/uploads',
    path: '/event-payments/p1/attachments',
  } as unknown as Request;
  await guardTenantSession(UPLOAD)(request, res, out.next as unknown as NextFunction);
  return out;
}

async function adminCookie(features?: FeatureKey[]): Promise<string> {
  const tenant = await createTestTenant('tenant-a', undefined, { features });
  const id = await createUserWithPassword('ad@test.local');
  await addMember(id, tenant.id, 'admin');
  return signInCookie('ad@test.local');
}

describe('guardTenantSession module gate', () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(() => vi.restoreAllMocks());

  it('answers 403 FEATURE_NOT_ENABLED to an upload when events is off', async () => {
    const cookie = await adminCookie(['quotes', 'notifications']);
    const r = await run(cookie);
    expect(r.status).toBe(403);
    expect(r.body).toEqual({ errorCode: 'FEATURE_NOT_ENABLED' });
    expect(r.next).not.toHaveBeenCalled();
  });

  it('lets a read through when events is off', async () => {
    const cookie = await adminCookie(['quotes']);
    const r = await run(cookie, 'GET');
    expect(r.next).toHaveBeenCalledTimes(1);
  });

  it('lets the upload through when events is on', async () => {
    const cookie = await adminCookie();
    const r = await run(cookie);
    expect(r.status).toBeNull();
    expect(r.next).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the features cannot be read, and retries on the next request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cookie = await adminCookie();
    vi.mocked(loadTenantFeatures).mockRejectedValueOnce(new Error('db down'));

    const failed = await run(cookie);
    expect(failed.status).toBe(403);
    expect(failed.body).toEqual({ errorCode: 'FEATURE_NOT_ENABLED' });
    expect(failed.next).not.toHaveBeenCalled();

    const retried = await run(cookie);
    expect(retried.next).toHaveBeenCalledTimes(1);
  });
});
