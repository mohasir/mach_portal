import { describe, expect, it } from 'vitest';
import { TRPCError } from '@trpc/server';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { z } from 'zod';
import { AppError, ErrorCodes } from '../../../lib/errors';
import { TRPC_MAX_BATCH_SIZE } from '../batch';
import { publicProcedure, router } from '../trpc';

const SQL_LEAK =
  'Failed query: delete from "clients" where "tenant_id" = $2\nparams: 2aa648af,8972fb5e-tenant';

const testRouter = router({
  dbFailure: publicProcedure.query(() => {
    throw new Error(SQL_LEAK, { cause: { code: '23503' } });
  }),
  appInternal: publicProcedure.query(() => {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      cause: new AppError(ErrorCodes.quote.PDF_GENERATION_FAILED),
    });
  }),
  notFound: publicProcedure.query(() => {
    throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.client.NOT_FOUND) });
  }),
  echo: publicProcedure.input(z.object({ n: z.number() })).query(({ input }) => input.n),
});

async function call(path: string, query = '') {
  const res = await fetchRequestHandler({
    endpoint: '/trpc',
    req: new Request(`http://localhost/trpc/${path}${query}`),
    router: testRouter,
    createContext: () => ({}) as never,
    maxBatchSize: TRPC_MAX_BATCH_SIZE,
  });
  return { status: res.status, body: await res.text() };
}

describe('tRPC errorFormatter', () => {
  it('hides the message and stack of an unexpected error', async () => {
    const { status, body } = await call('dbFailure');
    expect(status).toBe(500);
    expect(body).not.toContain('Failed query');
    expect(body).not.toContain('8972fb5e');
    const parsed = JSON.parse(body);
    expect(parsed.error.message).toBe('Internal server error');
    expect(parsed.error.data.stack).toBeUndefined();
    expect(parsed.error.data.errorCode).toBeNull();
  });

  it('keeps the domain code of an internal error raised on purpose', async () => {
    const parsed = JSON.parse((await call('appInternal')).body);
    expect(parsed.error.data.errorCode).toBe(ErrorCodes.quote.PDF_GENERATION_FAILED);
  });

  it('keeps the shape of an expected error', async () => {
    const { status, body } = await call('notFound');
    expect(status).toBe(404);
    expect(JSON.parse(body).error.data.errorCode).toBe(ErrorCodes.client.NOT_FOUND);
  });
});

describe('tRPC batch size cap', () => {
  const batch = (size: number) => {
    const paths = Array.from({ length: size }, () => 'echo').join(',');
    const input = Object.fromEntries(Array.from({ length: size }, (_, i) => [i, { n: i }]));
    return call(paths, `?batch=1&input=${encodeURIComponent(JSON.stringify(input))}`);
  };

  it('accepts a batch at the cap', async () => {
    expect((await batch(TRPC_MAX_BATCH_SIZE)).status).toBe(200);
  });

  it('rejects a batch above the cap', async () => {
    expect((await batch(TRPC_MAX_BATCH_SIZE + 1)).status).toBe(400);
  });
});
