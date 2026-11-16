import type { Request, Response, Router } from 'express';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { ACTIONS, RESOURCES } from '@repo/guards';
import { db, type Database } from '../../../db';
import * as schema from '../../../db/schema';
import { productImages, products } from '../../../db/schema';
import {
  createUserWithPassword,
  signInCookie,
  signInWithActiveOrg,
} from '../../../test/authHelpers';
import {
  addMember,
  addMemberWithGrants,
  createTestTenant,
  resetDb,
  testUnitId,
  type TestTenant,
} from '../../../test/db';
import { resolveTenantById } from '../../../lib/tenancy/tenantResolver';
import { TEST_APP_ROLE, testAppDatabaseUrl } from '../../../test/roles';
import { ProductImagesRepository } from '../products.images.repository';

const storage = vi.hoisted(() => ({
  upload: vi.fn(async ({ key }: { key: string }) => ({ key, url: `http://r2/${key}` })),
  delete: vi.fn(async () => undefined),
}));
vi.mock('../../../lib/storage', () => ({ getStorageProvider: () => storage }));

const { productImagesRouter, createProductImagesRouter } = await import('../products.express');

type Reply = { status: number | null; body: unknown };
type UploadFile = { buffer: Buffer; mimetype: string; originalname: string; size: number };

let png: Buffer;
beforeAll(async () => {
  png = await sharp({
    create: { width: 320, height: 240, channels: 3, background: { r: 0, g: 160, b: 90 } },
  })
    .png()
    .toBuffer();
});

const pngFile = (): UploadFile => ({
  buffer: png,
  mimetype: 'image/png',
  originalname: 'photo.png',
  size: png.length,
});

// Drives the real router (guard, multipart parser, handler and error handler) with a request
// that already carries the parsed file: the parser lets non-multipart requests through untouched.
function post(
  productId: string,
  cookie?: string,
  router: Router = productImagesRouter,
  file: UploadFile = pngFile(),
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const out: Reply = { status: null, body: undefined };
    const headers: Record<string, string> = {};
    if (cookie) headers['cookie'] = cookie;
    const path = `/${productId}/images`;
    const req = {
      method: 'POST',
      url: path,
      originalUrl: `/api/uploads/products${path}`,
      baseUrl: '/api/uploads/products',
      path,
      headers,
      file,
    } as unknown as Request;
    const res = {
      locals: {},
      headersSent: false,
      status(code: number) {
        out.status = code;
        return this;
      },
      json(body: unknown) {
        out.body = body;
        resolve(out);
        return this;
      },
    } as unknown as Response;
    router(req, res, (err?: unknown) =>
      err ? reject(err) : reject(new Error('request fell through the router')),
    );
  });
}

const imagesOf = (productId: string) =>
  db.select().from(productImages).where(eq(productImages.productId, productId));

const insertProduct = async (tenantId: string, name: string) =>
  (
    await db
      .insert(products)
      .values({ tenantId, name, uomId: await testUnitId(tenantId), price: 100 })
      .returning({ id: products.id })
  )[0]!.id;

async function seedTenants() {
  const tenantA = await createTestTenant('tenant-a');
  const tenantB = await createTestTenant('tenant-b');
  const owner = await createUserWithPassword('owner@test.local');
  await addMember(owner, tenantA.id, 'admin');
  await addMember(owner, tenantB.id, 'admin');
  const a: TestTenant = { ...tenantA, userId: owner };
  const b: TestTenant = { ...tenantB, userId: owner };
  return {
    a,
    b,
    productA: await insertProduct(a.id, 'Bar A'),
    productB: await insertProduct(b.id, 'Bar B'),
  };
}

describe('product image upload route', () => {
  let a: TestTenant;
  let b: TestTenant;
  let productA: string;
  let productB: string;

  beforeEach(async () => {
    await resetDb();
    storage.upload.mockClear();
    storage.delete.mockClear();
    ({ a, b, productA, productB } = await seedTenants());
  });
  afterEach(() => vi.restoreAllMocks());

  it('401 without a session; nothing is uploaded', async () => {
    expect(await post(productA)).toEqual({ status: 401, body: { errorCode: 'UNAUTHORIZED' } });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('403 FORBIDDEN when the role can read products but not update them', async () => {
    const userId = await createUserWithPassword('reader@test.local');
    await addMemberWithGrants(userId, a.id, [[RESOURCES.PRODUCT, ACTIONS.READ, 'all']]);
    const cookie = await signInCookie('reader@test.local');
    expect(await post(productA, cookie)).toEqual({ status: 403, body: { errorCode: 'FORBIDDEN' } });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('201 with product.update alone', async () => {
    const userId = await createUserWithPassword('editor@test.local');
    await addMemberWithGrants(userId, a.id, [[RESOURCES.PRODUCT, ACTIONS.UPDATE, 'all']]);
    const cookie = await signInCookie('editor@test.local');
    expect((await post(productA, cookie)).status).toBe(201);
  });

  it('404 PRODUCT_NOT_FOUND for a product of another tenant; nothing uploaded or inserted', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, b.id);
    expect(await post(productA, cookie)).toEqual({
      status: 404,
      body: { errorCode: 'PRODUCT_NOT_FOUND' },
    });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(await imagesOf(productA)).toEqual([]);
  });

  it('404 PRODUCT_NOT_FOUND for an id that is not a uuid', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, a.id);
    expect(await post('not-a-uuid', cookie)).toEqual({
      status: 404,
      body: { errorCode: 'PRODUCT_NOT_FOUND' },
    });
  });

  it('201 stores the image of the active tenant and answers the image resource', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, b.id);
    const r = await post(productB, cookie);
    expect(r.status).toBe(201);
    const [row] = await imagesOf(productB);
    expect(row).toMatchObject({ tenantId: b.id, isFeatured: true, createdById: b.userId });
    expect(row!.imageKey.startsWith(`t/${b.id}/products/${productB}/`)).toBe(true);
    expect(r.body).toEqual({
      id: row!.id,
      imageUrl: row!.imageUrl,
      thumbUrl: row!.thumbUrl,
      isFeatured: true,
      sortOrder: 0,
    });
  });

  it('400 PRODUCT_IMAGE_INVALID_IMAGE for bytes that are not an image', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, a.id);
    const fake = { ...pngFile(), buffer: Buffer.from('not a png'), size: 9 };
    expect(await post(productA, cookie, productImagesRouter, fake)).toEqual({
      status: 400,
      body: { errorCode: 'PRODUCT_IMAGE_INVALID_IMAGE' },
    });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('400 PRODUCT_IMAGE_INVALID_IMAGE for SVG content declared as a PNG', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, a.id);
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><rect width="64" height="48"/></svg>',
    );
    const disguised = { ...pngFile(), buffer: svg, size: svg.length };
    expect(await post(productA, cookie, productImagesRouter, disguised)).toEqual({
      status: 400,
      body: { errorCode: 'PRODUCT_IMAGE_INVALID_IMAGE' },
    });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(await imagesOf(productA)).toEqual([]);
  });

  it('409 PRODUCT_IMAGE_LIMIT_REACHED once the product is full', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, a.id);
    for (let i = 0; i < 5; i++) expect((await post(productA, cookie)).status).toBe(201);
    storage.upload.mockClear();
    expect(await post(productA, cookie)).toEqual({
      status: 409,
      body: { errorCode: 'PRODUCT_IMAGE_LIMIT_REACHED' },
    });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('500 PRODUCT_IMAGE_UPLOAD_FAILED and both files removed when the row cannot be saved', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, a.id);
    vi.spyOn(ProductImagesRepository.prototype, 'insert').mockRejectedValueOnce(
      new Error('insert failed'),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await post(productA, cookie)).toEqual({
      status: 500,
      body: { errorCode: 'PRODUCT_IMAGE_UPLOAD_FAILED' },
    });
    const keys = storage.upload.mock.calls.map(([params]) => params.key).sort();
    expect(keys).toHaveLength(2);
    expect(
      storage.delete.mock.calls.map((call) => (call as unknown as [string])[0]).sort(),
    ).toEqual(keys);
    expect(await imagesOf(productA)).toEqual([]);
  });
});

describe('product image upload route with the app role', () => {
  let appClient: ReturnType<typeof postgres>;
  let appRoleRouter: Router;
  let a: TestTenant;
  let b: TestTenant;
  let productA: string;
  let productB: string;

  beforeAll(() => {
    appClient = postgres(testAppDatabaseUrl(), { max: 2 });
    appRoleRouter = createProductImagesRouter(
      drizzle(appClient, { schema }) as unknown as Database,
    );
  });
  afterAll(async () => {
    await appClient?.end();
  });

  beforeEach(async () => {
    await resetDb();
    storage.upload.mockClear();
    storage.delete.mockClear();
    ({ a, b, productA, productB } = await seedTenants());
  });
  afterEach(() => vi.restoreAllMocks());

  // The organization row is cached by the resolver; warming it first leaves the app-role client as
  // the only one the route may use. Every method that would take a global-pool connection is spied.
  async function spyGlobalPool(tenantId: string) {
    await resolveTenantById(tenantId);
    return (
      [
        'select',
        'selectDistinct',
        'selectDistinctOn',
        '$count',
        'with',
        'insert',
        'update',
        'delete',
        'execute',
        'transaction',
      ] as const
    ).map((method) => vi.spyOn(db, method));
  }

  it('404 PRODUCT_NOT_FOUND for a product of another tenant', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, b.id);
    const spies = await spyGlobalPool(b.id);
    expect(await post(productA, cookie, appRoleRouter)).toEqual({
      status: 404,
      body: { errorCode: 'PRODUCT_NOT_FOUND' },
    });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(await imagesOf(productA)).toEqual([]);
  });

  it('201 for a product of the session tenant, stored under that tenant', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, b.id);
    const spies = await spyGlobalPool(b.id);
    expect((await post(productB, cookie, appRoleRouter)).status).toBe(201);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    expect(await imagesOf(productB)).toHaveLength(1);
    expect(await imagesOf(productA)).toEqual([]);
  });

  it('holds no transaction while the image is processed and uploaded', async () => {
    const cookie = await signInWithActiveOrg('owner@test.local', a.userId, a.id);
    const idle: number[] = [];
    storage.upload.mockImplementation(async ({ key }: { key: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      idle.push(await appConnectionsIdleInTx());
      return { key, url: `http://r2/${key}` };
    });
    expect((await post(productA, cookie, appRoleRouter)).status).toBe(201);
    expect(idle).toEqual([0, 0]);
    expect(await imagesOf(productA)).toHaveLength(1);
  });
});

const IDLE_IN_TX = sql`
  select count(*)::int as n from pg_stat_activity
  where usename = ${TEST_APP_ROLE} and state like 'idle in transaction%'`;

async function appConnectionsIdleInTx(): Promise<number> {
  const rows = (await db.execute(IDLE_IN_TX)) as unknown as { n: number }[];
  return rows[0]!.n;
}
