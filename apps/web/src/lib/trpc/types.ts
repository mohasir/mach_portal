import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';

/** Tipos de input de cada procedure (derivados de los schemas Zod del router). */
export type RouterInputs = inferRouterInputs<AppRouter>;
/** Tipos de output de cada procedure (entidades del dominio tal como las devuelve la API). */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
