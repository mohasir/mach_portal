# Especificación de Arquitectura — Backend (API)

> **Propósito de este documento**
> Es una *especificación de arquitectura orientada a IA* (Spec-Driven Development). Describe **cómo se construye** el backend de `mach-portal` y **las reglas estrictas que un agente de IA debe seguir** para añadir o modificar un módulo de forma consistente.
>
> Es el **patrón único** para todo módulo. Los ejemplos usan un recurso genérico de placeholder: **`X`** para la entidad y las clases (`XRepository`, `XService`, …), **`<module>`** para el directorio y la clave del router. Sustituir por el recurso real.
>
> Documento hermano: `docs/frontend/architecture.md` (app web). El contrato entre ambos son los schemas Zod de **`@repo/schemas`** y la inferencia de tipos del router (`AppRouter`).

---

## 1. Stack y principios

| Capa | Tecnología |
| --- | --- |
| Runtime / HTTP | **Express 5** |
| API / RPC | **tRPC v11** (adapter Express) |
| ORM / DB | **Drizzle** + **Postgres** (`postgres-js`) |
| Auth | **Better Auth** (plugin `admin` para RBAC) |
| Validación / contrato | **Zod 4** compartido vía **`@repo/schemas`** |
| Autorización | **`@repo/guards`** (catálogo `ac`/`roles`/`hasPermission`) |
| Monorepo | **Turborepo** + **pnpm workspaces** |

### Principios no negociables

1. **Módulo por dominio, en tres capas.** Cada recurso vive en `apps/api/src/modules/<module>/` y se separa en **`repository` → `service` → `router`**, más un **`resource`** que define la forma de salida. La dependencia va en una sola dirección: `router` usa `service`, `service` usa `repository`; nunca al revés.
2. **El contrato es Zod (`@repo/schemas`).** Todo input de una query/mutation se valida con un schema Zod compartido con el front. Es la **fuente de verdad** de la validación y del tipo del input.
3. **La salida se moldea con un `resource`.** Lo que sale de la API pasa **siempre** por `<module>.resource.ts` (selección de columnas + shape). Nunca se devuelve la fila cruda de Drizzle (evita filtrar campos sensibles y fija el contrato de salida que el front infiere).
4. **Autorización declarativa por permiso.** Los procedures se protegen con `guardedProcedure({ [RESOURCES.X]: [ACTIONS.Y] })`, que evalúa el rol de la sesión contra `@repo/guards` (sin roundtrip a DB). Nunca `if (role === 'admin')` a mano.
5. **Errores de dominio centralizados.** Los errores previsibles se lanzan como `TRPCError` con `cause: new AppError(ErrorCodes.<grupo>.<CODE>)`. El `errorFormatter` expone ese `errorCode` estable que el front traduce.
6. **Listas paginadas server-side.** Las listas usan `listQuerySchema` (page/pageSize/search/sortDir) extendido con el `sortBy` del módulo, y devuelven `Paginated<T>` (`{ items, pagination }`). El whitelist de columnas ordenables vive en el repository.
7. **Tipos inferidos, no DTOs a mano.** El front infiere entidades de `inferRouterOutputs<AppRouter>`; el backend no declara DTOs de respuesta duplicados — el `resource` ES el shape.

---

## 2. Estructura de directorios

```
apps/api/src/
├── modules/                          # DOMINIO. Un directorio por recurso.
│   └── <module>/
│       ├── <module>.resource.ts      # Selección de columnas + shape de salida (contrato de respuesta)
│       ├── <module>.repository.ts    # Drizzle: queries puras (findPaginated, updateById, deleteById...)
│       ├── <module>.service.ts       # Orquestación + reglas de negocio + errores + paginación
│       └── <module>.router.ts        # Procedures tRPC (guardedProcedure + schemas Zod)
│
├── trpc/
│   ├── trpc.ts                       # initTRPC, router, procedures (public/protected/guarded), errorFormatter
│   ├── router.ts                     # appRouter: registra los routers de módulo. Exporta AppRouter.
│   └── context.ts                    # createContext: resuelve la sesión (Better Auth) → ctx.session
│
├── lib/
│   ├── auth.ts                       # betterAuth(...) con el plugin admin ({ ac, roles, defaultRole, adminRoles })
│   └── errors/                       # AppError + ErrorCodes (catálogo de códigos de dominio)
│
├── db/
│   ├── index.ts                      # cliente Drizzle (`db`) + `type Database`
│   ├── schema/                       # tablas Drizzle (auth.ts generado por Better Auth, + dominio)
│   ├── seeds/                        # seeders idempotentes
│   └── scripts/                      # reset / utilidades
│
└── env.ts                            # variables de entorno validadas
```

Los schemas Zod **no** viven en `apps/api`: viven en **`packages/schemas/src/<module>.ts`** (`@repo/schemas`) y los consumen router (BE) y front (FE) por igual.

---

## 3. Anatomía de un módulo

| Capa | Archivo | Responsabilidad | Qué NO hace |
| --- | --- | --- | --- |
| **Contrato** | `@repo/schemas/src/<module>.ts` | Zod de input (`createXSchema`, `updateXSchema`) + query de lista (`xListQuerySchema`). Mensajes = claves i18n. | Nada de DB ni de tRPC. |
| **Resource** | `<module>.resource.ts` | Selección de columnas públicas + función `xResource(row)` que fija el shape de salida. | Queries, lógica de negocio. |
| **Repository** | `<module>.repository.ts` | Queries Drizzle puras: `findPaginated`, `updateById`, `deleteById`, lookups. Recibe `db` por constructor. | Reglas de negocio, throws de dominio, paginación meta. |
| **Service** | `<module>.service.ts` | Orquesta el repo, arma `Paginated` con `paginationMeta`, aplica reglas, lanza `TRPCError`+`AppError`. | Tocar `db` directo, saber de tRPC `ctx`. |
| **Router** | `<module>.router.ts` | Procedures: `guardedProcedure(perm).input(schema).query/mutation`. Reglas que dependen de `ctx`. | Queries Drizzle, shaping de salida. |

### 3.1 Contrato (`@repo/schemas/src/<module>.ts`)

Los mensajes de validación son **claves i18n** (el front las traduce). La query de lista extiende `listQuerySchema` con el enum de columnas ordenables del módulo.

```ts
// packages/schemas/src/<module>.ts
import { z } from 'zod';
import { listQuerySchema } from './pagination';

export const xListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'status', 'createdAt']).default('createdAt'),
});
export type XListQuery = z.infer<typeof xListQuerySchema>;

export const createXSchema = z.object({
  name: z.string().min(1, '<module>.validation.nameRequired').max(120),
  status: z.enum(['active', 'inactive']),
});

// La edición es su propio objeto (solo los campos editables), no `createXSchema.partial()`.
export const updateXSchema = z.object({
  name: z.string().min(1, '<module>.validation.nameRequired').max(120),
  status: z.enum(['active', 'inactive']),
});

export type CreateXInput = z.infer<typeof createXSchema>;
export type UpdateXInput = z.infer<typeof updateXSchema>;
```

Reexportar el módulo en `packages/schemas/src/index.ts`.

### 3.2 Resource (`<module>.resource.ts`) — contrato de salida

Define **qué columnas** se seleccionan y **qué shape** sale. Todo lo que devuelve el service pasa por acá.

```ts
// modules/<module>/<module>.resource.ts
import { x } from '../../db/schema';

export const publicXColumns = {
  id: x.id,
  name: x.name,
  status: x.status,
  createdAt: x.createdAt,
} as const;

export type PublicX = Pick<typeof x.$inferSelect, keyof typeof publicXColumns>;

export const xResource = (row: PublicX) => ({
  id: row.id,
  name: row.name,
  status: row.status,
  createdAt: row.createdAt,
});

export const xCollectionResource = (rows: PublicX[]) => rows.map(xResource);
export type XResource = ReturnType<typeof xResource>;
```

> Campos **calculados** (agregados, conteos relacionados) se agregan a la selección con `sql<...>\`...\`` en el repository y se suman al shape del resource.

### 3.3 Repository (`<module>.repository.ts`)

Queries Drizzle puras. Recibe `db: Database` por constructor (testeable). `findPaginated` implementa search + sort (por un **whitelist** de columnas) + `limit/offset` + count.

```ts
// modules/<module>/<module>.repository.ts
import { asc, count, desc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import type { XListQuery } from '@repo/schemas';
import type { Database } from '../../db';
import { x } from '../../db/schema';
import { publicXColumns } from './<module>.resource';

const sortColumns = { name: x.name, status: x.status, createdAt: x.createdAt } as const;

export class XRepository {
  constructor(private db: Database) {}

  async findPaginated(query: XListQuery) {
    const { page, pageSize, search, sortBy, sortDir } = query;
    const where = search ? ilike(x.name, `%${search}%`) : undefined;
    const orderBy = (sortDir === 'asc' ? asc : desc)(sortColumns[sortBy]);

    const items = await this.db
      .select(publicXColumns).from(x).where(where)
      .orderBy(orderBy).limit(pageSize).offset((page - 1) * pageSize);

    const total = await this.countAll(where);
    return { items, total };
  }

  private async countAll(where: SQL | undefined) {
    const [row] = await this.db.select({ value: count() }).from(x).where(where);
    return row?.value ?? 0;
  }

  create(data: typeof x.$inferInsert) {
    return this.db.insert(x).values(data).returning(publicXColumns).then((r) => r[0]);
  }

  updateById(id: string, data: Partial<typeof x.$inferInsert>) {
    return this.db.update(x).set({ ...data, updatedAt: new Date() })
      .where(eq(x.id, id)).returning(publicXColumns).then((r) => r[0]);
  }

  deleteById(id: string) {
    return this.db.delete(x).where(eq(x.id, id)).returning({ id: x.id }).then((r) => r[0]);
  }
}
```

### 3.4 Service (`<module>.service.ts`)

Orquesta el repo, arma la paginación con `paginationMeta`, aplica reglas de negocio y lanza errores de dominio. Devuelve datos ya pasados por el `resource`.

```ts
// modules/<module>/<module>.service.ts
import { TRPCError } from '@trpc/server';
import { paginationMeta, type CreateXInput, type UpdateXInput, type XListQuery } from '@repo/schemas';
import { AppError, ErrorCodes } from '../../lib/errors';
import { XRepository } from './<module>.repository';
import { xCollectionResource, xResource } from './<module>.resource';

export class XService {
  constructor(private repo: XRepository) {}

  async list(query: XListQuery) {
    const { items, total } = await this.repo.findPaginated(query);
    return {
      items: xCollectionResource(items),
      pagination: paginationMeta(total, query.page, query.pageSize),
    };
  }

  async create(input: CreateXInput) {
    const created = await this.repo.create(input);
    return xResource(created);
  }

  async update(id: string, input: UpdateXInput) {
    const updated = await this.repo.updateById(id, input);
    if (!updated) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.x.NOT_FOUND) });
    return xResource(updated);
  }

  async remove(id: string) {
    const deleted = await this.repo.deleteById(id);
    if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.x.NOT_FOUND) });
    return deleted;
  }
}
```

### 3.5 Router (`<module>.router.ts`)

Instancia `service(new repository(db))`. Cada procedure: `guardedProcedure(permiso).input(schema).query|mutation`. Las reglas que dependen de `ctx` (ej. impedir que el actor se afecte a sí mismo) viven acá.

```ts
// modules/<module>/<module>.router.ts
import { z } from 'zod';
import { createXSchema, updateXSchema, xListQuerySchema } from '@repo/schemas';
import { RESOURCES, ACTIONS } from '@repo/guards';
import { router, guardedProcedure } from '../../trpc/trpc';
import { db } from '../../db';
import { XRepository } from './<module>.repository';
import { XService } from './<module>.service';

const service = new XService(new XRepository(db));

export const xRouter = router({
  list: guardedProcedure({ [RESOURCES.X]: [ACTIONS.LIST] }).input(xListQuerySchema).query(({ input }) => service.list(input)),
  create: guardedProcedure({ [RESOURCES.X]: [ACTIONS.CREATE] }).input(createXSchema).mutation(({ input }) => service.create(input)),
  update: guardedProcedure({ [RESOURCES.X]: [ACTIONS.UPDATE] })
    .input(z.object({ id: z.string(), data: updateXSchema }))
    .mutation(({ input }) => service.update(input.id, input.data)),
  delete: guardedProcedure({ [RESOURCES.X]: [ACTIONS.DELETE] })
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => service.remove(input.id)),
});
```

Registrar en `trpc/router.ts`:

```ts
export const appRouter = router({ <module>: xRouter /* , ... */ });
export type AppRouter = typeof appRouter;
```

---

## 4. tRPC base (`trpc/`)

```ts
// trpc/trpc.ts
export const router = t.router;
export const publicProcedure = t.procedure;

// Sesión requerida. Setea ctx.user / ctx.session.
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user: ctx.session.user, session: ctx.session } });
});

// Sesión + permiso. Evalúa el rol contra @repo/guards (sin ir a DB).
export function guardedProcedure(permissions: PermissionCheck) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = (ctx.user as { role?: string | null }).role;
    if (!hasPermission(role, permissions)) throw new TRPCError({ code: 'FORBIDDEN' });
    return next();
  });
}
```

- **`context.ts`** resuelve la sesión con Better Auth (`auth.api.getSession`) y la expone como `ctx.session`.
- **Regla:** las queries/mutations de dominio usan `guardedProcedure`. `protectedProcedure` solo si el endpoint no necesita permiso específico (solo sesión). `publicProcedure` solo para endpoints sin auth.

---

## 5. Errores de dominio (`lib/errors/`)

Catálogo de códigos agrupados por dominio. Cada código es un string estable.

```ts
// lib/errors/constants.ts
export const ErrorCodes = {
  x: {
    NOT_FOUND: 'X_NOT_FOUND',
    ALREADY_EXISTS: 'X_ALREADY_EXISTS',
  },
} as const;
```

```ts
// lib/errors/AppError.ts
export class AppError extends Error {
  constructor(public readonly code: ErrorCode, message?: string) { super(message ?? code); this.name = 'AppError'; }
}
```

El `errorFormatter` de `trpc.ts` adjunta `errorCode` (el `code` del `AppError` que viaja como `cause`) o `null`:

```ts
errorFormatter({ shape, error }) {
  return { ...shape, data: { ...shape.data, errorCode: error.cause instanceof AppError ? error.cause.code : null } };
}
```

> **Contrato con el front:** cada `errorCode` nuevo **debe** tener su clave en `apps/web/src/locales/*/api.json` bajo `errors.<CODE>`. Los `code` estándar de tRPC (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `CONFLICT`, `INTERNAL_SERVER_ERROR`) ya tienen su clave. Ver `docs/frontend/architecture.md` §Datos y errores.

Agregar un código = agregar el grupo/clave en `ErrorCodes` + la traducción en `api.json` (es/en).

---

## 6. Paginación (`@repo/schemas/pagination`)

Base compartida de toda lista server-driven. Cada módulo la extiende con su `sortBy`.

```ts
export const listQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).optional(),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export interface Paginated<T> { items: T[]; pagination: PaginationMeta; }
export function paginationMeta(total, page, pageSize): PaginationMeta { /* total, page, pageSize, totalPages */ }
```

- El service **siempre** envuelve la lista en `{ items, pagination: paginationMeta(...) }`.
- El `sortBy` de cada módulo es un `z.enum([...])` = **whitelist** de columnas ordenables; el repository mapea ese enum a columnas Drizzle (`sortColumns`). Nunca aceptar un `sortBy` arbitrario.

---

## 7. Autorización (`@repo/guards` + Better Auth)

- Catálogo único en **`@repo/guards`** (`statements`/`ac`/`roles`/`hasPermission`), consumido por BE y FE.
- Backend: `lib/auth.ts` registra el plugin `admin({ ac, roles, defaultRole: DEFAULT_ROLE, adminRoles: ADMIN_ROLES })`; los procedures usan `guardedProcedure(permiso)`.
- **Recursos de dominio** se referencian con las constantes tipadas `RESOURCES`/`ACTIONS`: `guardedProcedure({ [RESOURCES.X]: [ACTIONS.READ] })`. **Nunca** literales sueltos.
- **Excepción:** los statements nativos de Better Auth (los que no son recursos de dominio) no tienen constante en `RESOURCES` — se referencian por su literal.
- Detalle del catálogo compartido y `hasPermission`: `docs/frontend/architecture.md` §Autorización (misma fuente de verdad).

---

## 8. Base de datos (Drizzle)

- Cliente en `db/index.ts` (`export const db`, `export type Database`); se inyecta al repository por constructor (testeable).
- Schema en `db/schema/` (barrel `index.ts`). `auth.ts` lo genera/gestiona Better Auth; tablas de dominio se agregan aparte y se reexportan en el barrel.
- El proyecto usa **`db:push`** (sin migraciones versionadas). Tras cambiar el schema: `pnpm --filter api db:push`.
- Borrados: definir `onDelete: 'cascade'` en las FKs cuando corresponda.

---

## 9. Receta — Añadir un módulo backend nuevo

1. **Contrato** (`packages/schemas/src/<module>.ts`): `xListQuerySchema = listQuerySchema.extend({ sortBy })`, `createXSchema`, `updateXSchema` (mensajes = claves i18n). Reexportar en el `index.ts` del paquete.
2. **DB** (si aplica): tabla Drizzle en `db/schema/`, reexportar en el barrel; `db:push`.
3. **Resource** (`<module>.resource.ts`): `publicXColumns`, `xResource(row)`, `xCollectionResource`.
4. **Repository** (`<module>.repository.ts`): `constructor(db)`, `findPaginated(query)` (search + `sortColumns` whitelist + limit/offset + count), `create`, `updateById`, `deleteById`.
5. **Service** (`<module>.service.ts`): `constructor(repo)`, `list` → `Paginated` con `paginationMeta`, `create/update/remove` con reglas y `TRPCError`+`AppError`.
6. **Router** (`<module>.router.ts`): `service = new XService(new XRepository(db))`; procedures `guardedProcedure({ [RESOURCES.X]: [ACTIONS.Y] }).input(schema).query/mutation`.
7. **Registrar** el router en `trpc/router.ts` (`appRouter`).
8. **Errores**: agregar códigos en `lib/errors/constants.ts` (`ErrorCodes.x.*`) y su traducción en `apps/web/src/locales/*/api.json`.
9. **Guards**: agregar el recurso a los `statements` de `@repo/guards` y a los roles que correspondan.

Con esto, el front puede inferir `RouterOutputs['<module>']['list']` y construir su feature (ver `docs/frontend/architecture.md`).

---

## 10. Anti-patrones (qué NO hacer)

- ❌ Devolver la fila cruda de Drizzle en vez de pasarla por `<module>.resource.ts`.
- ❌ Tocar `db` directo desde el service o el router (solo el repository habla con Drizzle).
- ❌ Poner reglas de negocio en el repository (van en el service).
- ❌ Aceptar un `sortBy` sin whitelist (`sortColumns`) — habilita ordenar por columnas arbitrarias.
- ❌ Chequear permisos con `if (role === 'admin')` en vez de `guardedProcedure` + `@repo/guards` (con `RESOURCES`/`ACTIONS`).
- ❌ Lanzar strings/errores crudos: usar `TRPCError` con `cause: new AppError(ErrorCodes...)` para errores de dominio.
- ❌ Escribir DTOs de respuesta a mano: el `resource` es el shape y el front lo infiere del router.
- ❌ Devolver listas sin `Paginated` / sin `paginationMeta`.
```
