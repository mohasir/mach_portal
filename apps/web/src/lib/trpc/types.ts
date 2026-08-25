import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';

export type RouterInputs = inferRouterInputs<AppRouter>;

export type RouterOutputs = inferRouterOutputs<AppRouter>;
