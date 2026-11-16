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
| Auth | **Better Auth** (plugin `organization` para tenants/membresías; `admin` solo por sus campos de usuario, sin uso para autorizar) |
| Validación / contrato | **Zod 4** compartido vía **`@repo/schemas`** |
| Autorización | **`@repo/guards`** (catálogo `TENANT_PERMISSIONS`, `can`/`scopeFor`, `ROLE_TEMPLATES`) sobre roles por organización (§7) |
| Monorepo | **Turborepo** + **pnpm workspaces** |

### Principios no negociables

1. **Módulo por dominio, en tres capas.** Cada recurso vive en `apps/api/src/modules/<module>/` y se separa en **`repository` → `service` → `router`**, más un **`resource`** que define la forma de salida. La dependencia va en una sola dirección: `router` usa `service`, `service` usa `repository`; nunca al revés.
2. **El contrato es Zod (`@repo/schemas`).** Todo input de una query/mutation se valida con un schema Zod compartido con el front. Es la **fuente de verdad** de la validación y del tipo del input.
3. **La salida se moldea con un `resource`.** Lo que sale de la API pasa **siempre** por `<module>.resource.ts` (selección de columnas + shape). Nunca se devuelve la fila cruda de Drizzle (evita filtrar campos sensibles y fija el contrato de salida que el front infiere).
4. **Autorización declarativa por permiso.** Los procedures se protegen con `guardedProcedure({ [RESOURCES.X]: [ACTIONS.Y] })`, que evalúa el rol de la sesión contra `@repo/guards` (sin roundtrip a DB). Nunca `if (role === 'admin')` a mano.
5. **Errores de dominio centralizados.** Los errores previsibles se lanzan como `TRPCError` con `cause: new AppError(ErrorCodes.<grupo>.<CODE>)`. El `errorFormatter` expone ese `errorCode` estable que el front traduce.
6. **Listas paginadas server-side.** Las listas usan `listQuerySchema` (page/pageSize/search/sortDir) extendido con el `sortBy` del módulo, y devuelven `Paginated<T>` (`{ items, pagination }`). El whitelist de columnas ordenables vive en el repository.
7. **Tipos inferidos, no DTOs a mano.** El front infiere entidades de `inferRouterOutputs<AppRouter>`; el backend no declara DTOs de respuesta duplicados — el `resource` ES el shape.
8. **Multi-tenant explícito.** Toda tabla de negocio lleva `tenant_id` y toda consulta lo filtra con `tenantEq`; el tenant sale de la sesión (`ctx.tenantId`), nunca del `input`. Receta completa en la §11: **leerla antes de tocar un repository**.

---

## 2. Estructura de directorios

```
apps/api/src/
├── modules/                          # DOMINIO. Un directorio por recurso.
│   └── <module>/
│       ├── <module>.resource.ts      # Selección de columnas + shape de salida (contrato de respuesta)
│       ├── <module>.repository.ts    # Drizzle: queries puras, siempre acotadas al tenant (`(db, tenantId)`)
│       ├── <module>.service.ts       # Orquestación + reglas de negocio + errores + paginación
│       ├── <module>.module.ts        # Factory `xModule(ctx)`: arma repository + service por request
│       ├── <module>.router.ts        # Procedures tRPC (guardedProcedure + schemas Zod)
│       └── test/                     # Tests del módulo (unitarios e `*.isolation.int.test.ts`)
│
├── core/trpc/
│   ├── trpc.ts                       # initTRPC, cadena de procedures (public/authed/tenant/protected/guarded), errorFormatter
│   ├── router.ts                     # appRouter: registra los routers de módulo. Exporta AppRouter.
│   ├── context.ts                    # createContext: sesión (Better Auth) → organización activa → ctx.tenant
│   ├── tenantCtx.ts                  # tipo TenantCtx ({ tenantId, user, session }) que reciben los xModule
│   └── platformAccess.ts             # auditoría de acceso de admin de plataforma (platform_access_log)
│
├── lib/
│   ├── auth.ts                       # betterAuth(...) con los plugins admin y organization; ganchos de sesión
│   ├── tenancy/                      # infraestructura multi-tenant: tenantEq, resolver (caché), access, TenancyRepository, createTenant, slug
│   └── errors/                       # AppError + ErrorCodes (catálogo de códigos de dominio)
│
├── db/
│   ├── index.ts                      # cliente Drizzle (`db`) + `type Database`
│   ├── schema/                       # tablas Drizzle (auth.ts generado por Better Auth, + dominio)
│   ├── seeds/                        # seeders idempotentes (reciben tenantId)
│   └── scripts/                      # migrate / baseline / mt:verify / reset / tenant:create
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
import { containsPattern } from '../../lib/utils/search';
import { publicXColumns } from './<module>.resource';

const sortColumns = { name: x.name, status: x.status, createdAt: x.createdAt } as const;

export class XRepository {
  constructor(private db: Database) {}

  async findPaginated(query: XListQuery) {
    const { page, pageSize, search, sortBy, sortDir } = query;
    const where = search ? ilike(x.name, containsPattern(search)) : undefined;
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

> **Multi-tenant:** el snippet de abajo es la forma mono-tenant, solo ilustrativa. En este proyecto el router no instancia nada a nivel de módulo: llama a `xModule(ctx)` por request (§11.2).

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

### 3.6 Tests (Vitest)

Las reglas de negocio del service se prueban con **Vitest**, sin base de datos: el service recibe
sus repositorios por constructor, así que el test lo instancia con objetos falsos que implementan
solo los métodos que usa (`vi.fn()`, casteados `as unknown as XRepository`).

```ts
// modules/<module>/<module>.service.test.ts
const repo = { findByName: vi.fn().mockResolvedValue(undefined), create: vi.fn() };
const service = new XService(repo as unknown as XRepository);

it('rejects a duplicated name', async () => {
  repo.findByName.mockResolvedValue({ id: 'other' });
  await expect(service.create({ name: 'A' })).rejects.toMatchObject({
    code: 'CONFLICT',
    cause: { code: 'X_ALREADY_EXISTS' },
  });
});
```

- Los tests viven en una subcarpeta `test/` del directorio del código que prueban (`modules/<module>/test/`, `lib/tenancy/test/`…), nunca sueltos junto al código. Correr con `pnpm --filter api test` (o `pnpm test` en la raíz).
- `src/test/setup.ts` mockea `src/env.ts` (valida `process.env` al importarse), así los tests no
  necesitan `.env`.
- Para "hoy", fijar el reloj con `vi.useFakeTimers()` + `vi.setSystemTime(...)`.
- Las queries del repository se prueban con tests de integración contra Postgres real (`*.int.test.ts`, `pnpm --filter api test:int`; ver §11.5).

---

## 4. tRPC base (`trpc/`)

```ts
// trpc/trpc.ts
export const router = t.router;
export const publicProcedure = t.procedure;

// Cadena multi-tenant (detalle en §11.1): sesión → organización activa → membresía → permiso.
export const authedProcedure = /* exige sesión */;
export const tenantProcedure = authedProcedure.use(/* exige ctx.tenant: TENANT_NOT_SELECTED / TENANT_NOT_FOUND */);
export const protectedProcedure = tenantProcedure.use(/* abre la transacción con el tenant fijado (§12); membresía o admin de plataforma; deja ctx.tenantId, ctx.access, ctx.db */);
export const shortTxProcedure = tenantProcedure.meta({ shortTx: true }).use(/* mismas comprobaciones, sin transacción larga (§12.4) */);

// Permiso sobre el acceso que protectedProcedure ya resolvió (ctx.access, detalle en §11.1).
export function guardedProcedure(permissions: PermissionCheck) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!can(ctx.access, permissions)) throw new TRPCError({ code: 'FORBIDDEN' });
    return next();
  });
}

// Pasa si se cumple por completo cualquiera de los checks (ej. roles.assignable: user.create O user.update).
export function guardedProcedureAnyOf(...checks: [PermissionCheck, ...PermissionCheck[]]) { /* … */ }
```

- **`context.ts`** resuelve la sesión con Better Auth (`auth.api.getSession`, sin caché de cookie) y la organización activa (`ctx.tenant`).
- **Regla:** las queries/mutations de dominio usan `guardedProcedure`. `protectedProcedure` solo si el endpoint no necesita permiso específico (membresía sin permiso). `authedProcedure`/`tenantProcedure` solo para los procedures de selección de organización (`tenant.*`). `publicProcedure` solo para endpoints sin auth.

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

Un `INTERNAL_SERVER_ERROR` cuya causa **no** es un `AppError` (un error de Drizzle/Postgres, un bug) sale con `message: 'Internal server error'` y sin `stack`, también en desarrollo: el mensaje de Drizzle trae el SQL, los parámetros y el `tenant_id`. El error completo solo se registra en el servidor (`onError` de `server.ts`). Por eso los conflictos previsibles se traducen a un error de dominio en el service: `isPgError(error, PG_UNIQUE_VIOLATION, '<constraint>')` (`lib/errors/pgError.ts`) → `CONFLICT` + `*_ALREADY_EXISTS`.

> **Contrato con el front:** cada `errorCode` nuevo **debe** tener su clave en `apps/web/src/locales/*/api.json` bajo `errors.<CODE>`. Los `code` estándar de tRPC (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, `CONFLICT`, `INTERNAL_SERVER_ERROR`) ya tienen su clave. Ver `docs/frontend/architecture.md` §Datos y errores.

Agregar un código = agregar el grupo/clave en `ErrorCodes` + la traducción en `api.json` (es/en).

---

## 6. Paginación (`@repo/schemas/pagination`)

Base compartida de toda lista server-driven. Cada módulo la extiende con su `sortBy`.

```ts
export const listQuerySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(200).refine((v) => !v.includes('\u0000')).optional(), // NUL → 400
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export interface Paginated<T> { items: T[]; pagination: PaginationMeta; }
export function paginationMeta(total, page, pageSize): PaginationMeta { /* total, page, pageSize, totalPages */ }
```

- El service **siempre** envuelve la lista en `{ items, pagination: paginationMeta(...) }`.
- El `sortBy` de cada módulo es un `z.enum([...])` = **whitelist** de columnas ordenables; el repository mapea ese enum a columnas Drizzle (`sortColumns`). Nunca aceptar un `sortBy` arbitrario.

---

## 7. Autorización (`@repo/guards` + Better Auth)

La autorización es **por membresía**: cada miembro tiene un rol de su organización (`member.role_id` → tabla `role`, con sus filas `role_permission`), y ese rol es lo único que autoriza. Ni `user.role` (global) ni `member.role` (texto heredado) se leen para autorizar (§11.1, §11.6).

- **Catálogo único en `@repo/guards`**, consumido por BE y FE:
  - `statements`: recursos de dominio (`permissionsMatrix`) + los de Better Auth. Tipa los checks (`PermissionCheck`).
  - **`TENANT_PERMISSIONS`** (`core/catalog.ts`): lo que un rol de organización **puede otorgar**. Es `statements` sin `session` y con solo las acciones de `user` que algún procedure chequea (`create`, `list`, `update`, `delete`, `set-password`). Lo leen el editor de roles (matriz), la validación de roles (`rolePermissionSchema` de `@repo/schemas` vía `isCatalogPermission`) y `resolveAccess`: un permiso fuera de él no se puede guardar ni autoriza aunque quede una fila vieja.
  - `can(access, check)` / `scopeFor(access, resource, action)` (`core/evaluate.ts`): evalúan un `AccessGrants` (`{ isOwner, grants: { 'recurso.acción': 'own' | 'all' } }`). El dueño (`isOwner`) pasa todo; un permiso fuera del catálogo nunca autoriza.
  - `SCOPED_ACTIONS` (`core/scopedActions.ts`): los pares (recurso, acción) que la API filtra por dueño del registro (§11.1). Solo ahí se acepta alcance `own`: la validación de roles rechaza `own` en cualquier otro permiso (`roles.validation.permissionScopeUnsupported`), y `scopeFor` lee como `all` una fila vieja guardada así.
  - `ROLE_TEMPLATES` (`mappings/roleTemplates.ts`, derivado de `rolesPermissionsMatrix`): los roles base que se siembran en cada organización nueva.
  - `ac`/`roles`/`DEFAULT_ROLE`/`ADMIN_ROLES`: **solo** para el plugin `admin` de Better Auth (`lib/auth.ts`), que exige un set de roles. Sus endpoints están bloqueados por HTTP y ningún service los llama; los roles globales no otorgan nada salvo el `superadmin` heredado.
- Los procedures usan `guardedProcedure(permiso)` (o `guardedProcedureAnyOf(...)` cuando alcanza cualquiera de varios permisos), que evalúan `ctx.access` con `can`.
- **Recursos de dominio** se referencian con las constantes tipadas `RESOURCES`/`ACTIONS`: `guardedProcedure({ [RESOURCES.X]: [ACTIONS.READ] })`. **Nunca** literales sueltos.
- **Excepción:** los statements nativos de Better Auth (`user`) no tienen constante en `RESOURCES` — el recurso va por su literal y la acción con `ACTIONS` cuando existe (`{ user: [ACTIONS.CREATE] }`).
- **Permiso nuevo del catálogo:** se agrega la acción en `permissionsMatrix` (y su etiqueta en `locales/*/roles.json` de la web). Con eso aparece **solo en el editor de roles**: ningún rol existente lo recibe (el dueño lo tiene por el bypass). Si un rol base debe traerlo, se agrega en `rolesPermissionsMatrix`, que alimenta `ROLE_TEMPLATES`; eso afecta solo a las organizaciones que se creen después (`seedTenantRoles` nunca reescribe roles existentes). Si la acción admite "solo los suyos", va también en `SCOPED_ACTIONS` y el procedure usa el helper de alcance (§11.1).
- Detalle del lado web (`usePermissions`, `useCan`, `<Can>`, guard de rutas): `docs/frontend/architecture.md` §9.

---

## 8. Base de datos (Drizzle)

- Cliente en `db/index.ts` (`export const db`, `export type Database`). Un repository **no** importa el `db` global: recibe por constructor `ctx.db` (la transacción de la petición) o el `tx` de `runInTenant` (§12). El `db` global (pool del rol `app`) solo lo usan: la cadena de tRPC (`core/trpc/trpc.ts`) y su auditoría de plataforma (`core/trpc/platformAccess.ts`), `guardTenantSession`, `withTenantTx` (pool por defecto), `modules/tenant/tenant.router.ts` (`authedProcedure`, solo tablas de identidad sin RLS), el job `jobs/eventReminders.job.ts`, y como valor por defecto de helpers de `lib/` (`resolveAccess`, `seedTenantRoles`, `TenancyRepository`; este último sin argumento en `tenantResolver` y `jobs/scripts/runEventReminders.ts`) y de las funciones `seedX` de `db/seeds/` (los scripts de seeds les pasan `platformDb()`). El arranque (`server.ts`) solo usa `queryClient` para la verificación de rol (§12.1).
- Schema en `db/schema/` (barrel `index.ts`). `auth.ts` lo genera/gestiona Better Auth; tablas de dominio se agregan aparte y se reexportan en el barrel.
- **Flujo de esquema (migraciones versionadas en `apps/api/drizzle/`):** cambiar el schema TS → `pnpm --filter api db:generate` → revisar (y si hace falta editar a mano) el SQL generado y commitearlo → `pnpm --filter api db:migrate` (con `DATABASE_OWNER_URL`, §12.1). Después de generar, `db:generate` debe responder "No schema changes" y `pnpm --filter api exec drizzle-kit check` "Everything's fine". No hay script `db:push`: solo el harness de integración usa `drizzle-kit push --force`, sobre su base descartable.
  - **Bases creadas con `push`** (sin filas en `drizzle.__drizzle_migrations`): ejecutar **una vez** `pnpm --filter api db:baseline` para registrar la migración `0000` como aplicada; si no, `db:migrate` intentaría recrear las tablas existentes. Se niega a correr si ya está registrada.
  - `pnpm --filter api mt:verify [--pre]` verifica el estado multi-tenant (conteos por tabla, filas sin `tenant_id`, huérfanas, duplicados, membresías, roles); solo hace `SELECT`. Runbook de cutover: `docs/superpowers/runbooks/multitenant-cutover.md`.
  - **Roles por organización (migraciones `0002`–`0004`):** se aplican con la app **detenida** y el código nuevo se despliega **en el mismo paso**. `0003` siembra los roles y enlaza cada membresía por su `member.role` heredado; `0004` deja `member.role_id` en `NOT NULL`, así que el código viejo (que inserta miembros sin `role_id`) falla después, y el código nuevo necesita las tablas `role`/`role_permission`. Orden: `mt:verify --pre` (guardar la salida) → `db:migrate` → `mt:verify` (debe salir sin problemas) → arrancar la app nueva.
  - `mt:verify --pre` falla con un `member.role` fuera de `superadmin|admin|operator|member` (`0003` lo rechaza) y **avisa** de cada organización sin ningún miembro `superadmin`: `0003` solo da el rol dueño a esos miembros, y las organizaciones creadas con su primer admin como `admin` quedan sin dueño (nadie puede gestionar roles). Después de migrar, un admin de plataforma entra a cada una de esas organizaciones y le asigna el rol dueño a un miembro con `users.update` (`roleId` del rol dueño).
  - Una migración con datos debe ser transaccional y fallar con un mensaje claro si falta un parámetro (`db:migrate --set clave=valor`, que viaja por la conexión directa, no por un pooler).
  - `db:fresh` = `db:preflight` (valida URLs y variables de entorno sin tocar la base, antes de borrar nada) + reset + `db:roles` + migrate + seed local de demostración (`--demo=local`). Re-ejecuta `db:roles` porque el reset borra el esquema `public` y con él los permisos del rol `app` (necesita `DATABASE_APP_URL` y `DATABASE_PLATFORM_URL`, de donde `db:roles` toma usuario y contraseña de cada rol).
  - **Variables de conexión por script (§12.1):** `db:migrate`, `db:reset`, `db:baseline`, `db:roles` y `db:studio` (`drizzle.config.ts`) usan `DATABASE_OWNER_URL`; `db:seed`, `tenant:create` y `mt:verify` usan `DATABASE_PLATFORM_URL`; la API y los jobs usan `DATABASE_APP_URL` (rol `app`). `db:studio` ve las filas de **todas** las organizaciones: no apuntarlo a producción con esa credencial salvo que sea imprescindible. `db:generate` no se conecta a la base. Ninguna lee `DATABASE_URL`: si el proveedor la inyecta, se ignora.
- Borrados: definir `onDelete: 'cascade'` en las FKs cuando corresponda.

### 8.1 Alta de tenants y semillas

- **Alta de un tenant:** `pnpm --filter api tenant:create --slug=<slug> --name=<nombre> --admin-email=<email> --admin-name=<nombre>`
  (llama a `createTenant` de `lib/tenancy/createTenant.ts`). Valida el slug (se pasa a minúsculas),
  crea la organización, siembra los defaults del tenant (`seedTenantDefaults`: config, tipos de
  evento, motivos de reprogramación, catálogo base, plantilla de PDF), siembra los roles base
  (`seedTenantRoles`, desde `ROLE_TEMPLATES`) y agrega al primer admin con el rol dueño. Si el email es nuevo imprime un enlace de contraseña (24 h); si la cuenta ya
  existe la adjunta sin tocar su contraseña. `quote_stages` es global y lo siembra `db:seed`.
- Toda función `seedX` recibe el `tenantId` y lo estampa en cada fila (hijas incluidas). Son idempotentes.
- **`pnpm --filter api db:seed`** (`--help` lista flags y usuarios demo):
  - `--demo=prod --tenant=<slug>`: etapas globales + defaults de un tenant **existente**. No crea
    cuentas ni membresías; si existe la cuenta del superadmin real, solo se la marca `isPlatformAdmin`
    (una membresía la eximiría de la auditoría de acceso de plataforma).
  - `--demo=local`: crea los tenants `demo-norte` ("Demo Norte") y `demo-sur` ("Demo Sur") con
    una demo completa y distinta en cada uno (clientes, staff, catálogo y precios, numeración —Sur
    empieza en 1001—, fechas, cotizaciones en todas las etapas, eventos, pagos, adjuntos solo como
    metadatos, reprogramaciones, notificaciones), para detectar fugas entre tenants a simple vista.
  - `--demo=local --tenant=<slug>`: la demo completa en un tenant existente (usuarios `<rol>@<slug>.demo`);
    imprime una advertencia porque agrega cuentas con contraseña conocida a ese tenant.
  - **Guardas de `--demo=local`** (`seeds/demoGuard.ts`, se evalúan antes de escribir): se rechaza con
    `NODE_ENV=production`; y sin `--tenant` se rechaza si ya existe una organización distinta de
    `demo-norte`/`demo-sur` (hay que pasar `--tenant=<slug>` explícito).
- `createTenant` rechaza (`USER_IS_PLATFORM_ADMIN`) un `adminEmail` que sea de un admin de plataforma:
  como miembro dejaría de auditarse su acceso.
- **Usuarios demo** (contraseña: `SEED_PASSWORD` o el default del seed; nunca credenciales reales):

  | Email | Rol (en su organización) |
  | --- | --- |
  | `superadmin@norte.demo` / `superadmin@sur.demo` | `superadmin` (rol dueño) |
  | `admin@norte.demo` / `admin@sur.demo` | `admin` |
  | `operator@norte.demo` / `operator@sur.demo` | `operator` |
  | `member1@…`, `member2@…` (`norte.demo` / `sur.demo`) | `member` |
  | `shared@demo.test` | miembro de ambos: `operator` en Norte, `member` en Sur (cada membresía autoriza con su propio rol) |
  | `platform@demo.test` | admin de plataforma (`isPlatformAdmin`), sin membresía |

---

## 9. Receta — Añadir un módulo backend nuevo

1. **Contrato** (`packages/schemas/src/<module>.ts`): `xListQuerySchema = listQuerySchema.extend({ sortBy })`, `createXSchema`, `updateXSchema` (mensajes = claves i18n). Reexportar en el `index.ts` del paquete.
2. **DB** (si aplica): tabla Drizzle en `db/schema/` **con `tenantId`** (§11.3), reexportar en el barrel; `db:generate` → revisar el SQL → `db:migrate` (§8). Agregar la tabla a la guarda `tenantTables.test.ts` (o a su lista de exentas, solo si es catálogo global).
3. **Resource** (`<module>.resource.ts`): `publicXColumns`, `xResource(row)`, `xCollectionResource`.
4. **Repository** (`<module>.repository.ts`): `constructor(db, tenantId)` con la receta de la §11.3, `findPaginated(query)` (search + `sortColumns` whitelist + limit/offset + count), `create`, `updateById`, `deleteById`.
5. **Service** (`<module>.service.ts`): `constructor(repo)`, `list` → `Paginated` con `paginationMeta`, `create/update/remove` con reglas y `TRPCError`+`AppError`.
6. **Module + Router**: `<module>.module.ts` exporta `xModule(ctx: TenantCtx)` que arma `new XService(new XRepository(db, ctx.tenantId))` (§11.2); el router llama `xModule(ctx).método(input)`; procedures `guardedProcedure({ [RESOURCES.X]: [ACTIONS.Y] }).input(schema).query/mutation`.
7. **Registrar** el router en `trpc/router.ts` (`appRouter`).
8. **Errores**: agregar códigos en `lib/errors/constants.ts` (`ErrorCodes.x.*`) y su traducción en `apps/web/src/locales/*/api.json`.
9. **Guards**: agregar el recurso y sus acciones a `permissionsMatrix` de `@repo/guards` (aparece en el editor de roles) y, si algún rol base debe traerlo, a `rolesPermissionsMatrix` (`ROLE_TEMPLATES`, solo organizaciones nuevas). Ver §7.
10. **Aislamiento**: test `modules/<module>/test/<module>.isolation.int.test.ts` con `seedTwoTenants` (§11.5).

Con esto, el front puede inferir `RouterOutputs['<module>']['list']` y construir su feature (ver `docs/frontend/architecture.md`).

---

## 10. Anti-patrones (qué NO hacer)

- ❌ Devolver la fila cruda de Drizzle en vez de pasarla por `<module>.resource.ts`.
- ❌ Tocar `db` directo desde el service o el router (solo el repository habla con Drizzle).
- ❌ Poner reglas de negocio en el repository (van en el service).
- ❌ Aceptar un `sortBy` sin whitelist (`sortColumns`) — habilita ordenar por columnas arbitrarias.
- ❌ Armar un patrón `like`/`ilike` con texto del usuario a mano (`` `%${search}%` ``): usar `containsPattern(search)` (`lib/utils/search.ts`), que escapa `%`, `_` y `\`.
- ❌ Chequear permisos con `if (role === 'admin')`, leyendo `user.role`/`member.role` o el nombre del rol, en vez de `guardedProcedure` + `ctx.access` (con `RESOURCES`/`ACTIONS`).
- ❌ Filtrar "solo los suyos" sin pasar por `ownerIdFor`/el helper de alcance del módulo, o con un par que no está en `SCOPED_ACTIONS`.
- ❌ Lanzar strings/errores crudos: usar `TRPCError` con `cause: new AppError(ErrorCodes...)` para errores de dominio.
- ❌ Escribir DTOs de respuesta a mano: el `resource` es el shape y el front lo infiere del router.
- ❌ Devolver listas sin `Paginated` / sin `paginationMeta`.
- ❌ Una query a una tabla con `tenant_id` sin `tenantEq` (incluye subqueries, `JOIN ... ON`, `EXISTS` y las consultas hechas con el handle de una transacción).
- ❌ Leer `tenantId` de un `input`, del cuerpo, de una cabecera o de la URL; o dejar que un `set(...)`/`values(...)` reciba un `tenantId` de afuera.
- ❌ Guardar un id recibido por `input` (`clientId`, `eventTypeId`, `assigneeId`…) sin resolverlo antes con una lectura acotada al tenant.
- ❌ Instanciar un repository o service a nivel de módulo (fuera de `xModule(ctx)`): existiría sin tenant.
- ❌ Escribir una ruta de Express fuera de tRPC sin `guardTenantSession`, o montarla fuera del `originGuard` de `server.ts` (rechaza métodos que cambian estado con un `Origin`/`Referer` que no está en `WEB_ORIGIN`).
- ❌ Importar el `db` global (o abrir conexiones propias) en un repository, service o controller de `modules/`: abre una segunda conexión fuera de la transacción de la petición, ve cero filas (RLS) y puede agotar el pool. `modules/test/noGlobalDb.test.ts` lo detecta.
- ❌ `set_config('app.tenant_id', …, false)` (a nivel de sesión) o `SET app.tenant_id`: la conexión vuelve al pool con el tenant fijado y lo filtra a la petición siguiente. Solo `withTenantTx` (`is_local = true`).
- ❌ Llamar a `ctx.runInTenant` dentro de un `protectedProcedure`/`guardedProcedure` salvo que se sepa lo que se hace: toma una segunda conexión mientras la de la petición sigue retenida.
- ❌ Capturar un error de base sobre `ctx.db` y seguir sin un punto de guardado (`this.db.transaction(...)` alrededor de la sentencia que puede fallar): una sentencia fallida aborta la transacción de la petición, el `COMMIT` final se convierte en un `ROLLBACK` silencioso y el cliente recibe éxito sin que se guarde nada. Capturar para relanzar otro error (ej. `TRPCError` de conflicto) sí está bien. Ejemplo: `UsersRepository.deleteAccountWithoutMemberships`.
- ❌ Retener la transacción de la petición durante una llamada externa lenta (PDF, R2): usar `guardedShortTxProcedure` (§12.4).
- ❌ Editar una migración ya aplicada, o cambiar el schema sin generar su migración.
```

---

## 11. Multi-tenant

Una sola instalación y un solo dominio; los datos de cada cliente (tenant) conviven en las mismas tablas, separados por `tenant_id`. El tenant de una petición es la **organización activa de la sesión** (plugin `organization` de Better Auth); `organization.id` es el `tenantId` y `organization.slug` su identificador estable. El aislamiento es por filtros explícitos en cada query (`tenantEq`) y, como segunda barrera, por RLS de Postgres (§12). Spec: `docs/superpowers/specs/2026-10-19-multitenant-fase1-design.md`; RLS: `docs/superpowers/specs/2026-11-08-multitenant-fase1b-rls-design.md`. Roles por organización (fase 2): `docs/superpowers/specs/2026-11-06-multitenant-fase2-roles-design.md`.

### 11.1 Cadena de procedures

```text
createContext      → sesión (sin caché de cookie) → organización activa → ctx.tenant (o null)
authedProcedure    → exige sesión                                   (solo tenant.memberships / tenant.select)
tenantProcedure    → exige organización activa: TENANT_NOT_SELECTED / TENANT_NOT_FOUND
protectedProcedure → abre la transacción de la petición con el tenant fijado (RLS, §12), resuelve el acceso
                     (membresía + rol, o admin de plataforma) y exige mustChangePassword resuelto;
                     deja ctx.tenantId, ctx.access, ctx.db (la transacción), ctx.runInTenant y ctx.afterCommit,
                     y la cabecera x-permissions-version
guardedProcedure   → can(ctx.access, permiso)        guardedProcedureAnyOf → alcanza con uno de varios checks
shortTxProcedure / guardedShortTxProcedure → mismas comprobaciones sin transacción larga (operaciones lentas, §12.4)
```

- **Autorización por membresía.** `protectedProcedure` (`core/trpc/trpc.ts`) primero decide, fuera de la transacción de la petición, si el usuario entra a la organización (`evaluateTenantAccess`, `lib/tenancy/access.ts`, lee `member`, tabla sin RLS) y, ya **dentro** de la transacción con el tenant fijado (§12), llama a `resolveAccess` (`lib/rbac/access.ts`), que lee **en cada petición, sin caché**, la membresía, su rol y los permisos del rol (con `tenantEq` en cada join; `role` y `role_permission` tienen RLS, así que fuera de esa transacción devolverían cero filas). El resultado queda en **`ctx.access`** (`ResolvedAccess`: `isOwner`, `grants`, `roleId`, `roleName`, `roleVersion`). Sacar a alguien de la organización o editar su rol surte efecto en la petición siguiente. Solo la fila de la organización (nombre, existencia) se cachea ~60 s en memoria (`lib/tenancy/tenantResolver.ts`).
- **Falla cerrado:** sin membresía, con `role_id` nulo o apuntando al rol de otra organización, `resolveAccess` devuelve `null` y la petición recibe `FORBIDDEN`. Las filas de permisos fuera de `TENANT_PERMISSIONS` se descartan.
- **Admin de plataforma** sin membresía: recibe `OWNER_ACCESS` (acceso de dueño sintético, sin rol: `roleId` nulo, versión `owner:0`) y su acceso se audita (abajo).
- **Cabecera `x-permissions-version`** (`core/express/const/headers.ts`): toda respuesta de un procedure con tenant lleva `<roleId>:<roleVersion>` (`permissionsVersion(access)`); `cors.ts` la expone (`exposedHeaders`). Cada edición de un rol incrementa su `version`, y un cambio de rol del miembro cambia el `roleId`: la web compara la cabecera con lo que tiene cargado y recarga sus permisos (`docs/frontend/architecture.md` §9.2). `tenant.permissions` (permisos completos + nombre del rol) y `tenant.permissionsVersion` usan `protectedProcedure`: cualquier miembro puede leer los suyos.
- **Alcance "solo los suyos"** (`own`/`all`): una acción de `SCOPED_ACTIONS` (`@repo/guards`) puede otorgarse con alcance `own`. El procedure gateado por esa acción calcula el dueño a filtrar con `ownerIdFor(ctx.access, ctx.user.id, [recurso, acción])` (`lib/rbac/ownerScope.ts`; en cotizaciones el helper `ownerScope` del router, en eventos `eventOwnerId`, que suma siempre `event.read`) y lo pasa al service; el repository filtra por creador o asignado (eventos y pagos, por la cotización de la que cuelgan). Solo con alcance `all` en todos los checks se levanta el filtro; un permiso ausente también restringe. **Regla:** cada procedure combina el alcance de `read` del recurso con el **de la acción que lo gatea** y gana el más estricto (así `quote.read=own` + `quote.update=all` no modifica cotizaciones que no puede ver), y el tipo `ScopedCheck` rechaza en compilación un par que no esté en `SCOPED_ACTIONS`. El test `lib/rbac/test/scopedActions.test.ts` cubre la otra dirección: falla si un par de `SCOPED_ACTIONS` (que el editor ofrece como own/all) no lo filtra ningún procedure. Una acción entre dueños por naturaleza (ej. `quote.manage_assignment`, reasignar) **no** va en `SCOPED_ACTIONS` ni se filtra.
- Las rutas de Express fuera de tRPC (hoy `/api/uploads/event-payments` y `/api/uploads/products`) usan el middleware `guardTenantSession` (`core/express/middleware/`), que replica la cadena `shortTxProcedure` check por check y en el mismo orden (`evaluateTenantAccess` + `resolveAccess` en una transacción corta + `can`) y deja el acceso en `res.locals.access` y el ejecutor de transacciones cortas en `res.locals.runInTenant` (§12.5). Una ruta nueva fuera de tRPC **debe** usarlo.
- La superficie HTTP de Better Auth está recortada: `/sign-up/email` y los endpoints de los plugins `organization` y `admin` se bloquean por HTTP; las llamadas internas (`auth.api.*`) siguen funcionando. El alta de usuarios y organizaciones pasa por `users.create` y `tenant:create`.
- **Login:** global (email + contraseña). Un gancho de sesión fija la organización activa: con una membresía se activa sola; con varias queda sin activa hasta `tenant.select`; sin ninguna se rechaza con `USER_NO_ORGANIZATION` (el admin de plataforma sin membresías sí entra). La web nunca lee la organización activa de `useSession`: usa `tenant.active`.
- **Admin de plataforma** (`user.isPlatformAdmin`, la única marca de plataforma; `user.role` no cuenta): puede seleccionar cualquier organización y, si no es miembro, entra con `OWNER_ACCESS`. Todo acceso sin membresía queda en `platform_access_log` (la primera query de cada sesión y tenant, y **todas** las mutaciones); la web muestra el aviso "modo plataforma". Un admin de plataforma que además es miembro no se audita, por eso `createTenant` rechaza (`USER_IS_PLATFORM_ADMIN`) un admin inicial que lo sea.

### 11.2 Factory `xModule(ctx)`

Ningún repository ni service existe sin tenant: se construyen por request desde el contexto.

```ts
// modules/<module>/<module>.module.ts
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { XRepository } from './<module>.repository';
import { XService } from './<module>.service';

export function xModule(ctx: TenantCtx) {
  // ctx.db es la transacción de la petición (RLS, §12): nunca importar el `db` global aquí.
  return new XService(new XRepository(ctx.db, ctx.tenantId));
}
```

```ts
// modules/<module>/<module>.router.ts
list: guardedProcedure({ [RESOURCES.X]: [ACTIONS.LIST] })
  .input(xListQuerySchema)
  .query(({ ctx, input }) => xModule(ctx).list(input)),
```

Si el service necesita repositories de otras entidades (ej. para resolver ids, §11.4), el `xModule` los construye con el mismo `ctx.tenantId`. Lo que dependa del actor (ej. `isPlatformAdmin`, `userId`) se pasa también desde `xModule`, no se lee del `input`.

### 11.3 Receta de repository

```ts
export class XRepository {
  constructor(private db: Database, private tenantId: string) {}

  findById(id: string) {
    return this.db.select(publicXColumns).from(x)
      .where(and(eq(x.id, id), tenantEq(x, this.tenantId)))
      .then((r) => r[0]);
  }

  create(data: CreateXInput) {
    // tenantId va al final y nunca sale del input: un campo ajeno no puede pisarlo.
    return this.db.insert(x).values({ ...data, tenantId: this.tenantId }).returning(publicXColumns).then((r) => r[0]);
  }

  updateById(id: string, data: UpdateXInput) {
    return this.db.update(x).set({ ...data, updatedAt: new Date() })
      .where(and(eq(x.id, id), tenantEq(x, this.tenantId))).returning(publicXColumns).then((r) => r[0]);
  }
}
```

Reglas (cada una la verifica una mutación manual en las pruebas de aislamiento):

1. **`tenantEq(tabla, tenantId)`** (`lib/tenancy/tenantEq.ts`) en **cada** lectura, actualización y borrado de una tabla con `tenant_id`: `WHERE` principal, subqueries, `EXISTS`, `COUNT`, y también en el **`ON` de cada `JOIN`** a otra tabla de tenant (un `JOIN` por id sin filtro puede traer la fila de otro tenant).
2. **Handles de transacción:** dentro de `db.transaction(async (tx) => …)` valen las mismas reglas; si se construye un repository ligado al `tx`, se le pasa el mismo `tenantId`.
3. **Inserts:** `tenantId` se estampa **al final** (`{ ...data, tenantId }`); las filas hijas también llevan su `tenant_id` (denormalizado). Los schemas Zod descartan claves desconocidas: no usar `.passthrough()` ni spreads más anchos que el input validado.
4. **Updates:** el `set(...)` nunca incluye `tenantId`.
5. **Unicidad:** los índices únicos de negocio son por tenant (`(tenant_id, name)`, `(tenant_id, seq)`…). Tablas de auth (`user`, `session`, `account`, `verification`) son globales, ver §11.6.
6. **Tablas de schema:** `tenant_id text NOT NULL`, FK a `organization.id`, indexado, sin default (helper `db/schema/tenantColumn.ts`). La guarda `src/db/schema/test/tenantTables.test.ts` falla si una tabla nueva no lo cumple o no está en la lista de exentas.
7. **Numeración y secuencias** por tenant: `max(seq)+1` dentro de la transacción bajo `pg_advisory_xact_lock` del tenant (cotizaciones).

### 11.4 Regla de FK: resolver cada id del input por lecturas acotadas

Las FK entre tablas de negocio **no** son compuestas con `tenant_id`, así que la base no impide guardar `quotes.clientId` apuntando a un cliente de otro tenant. La barrera es la capa de repository:

- Todo id recibido por `input` que referencie otra entidad (cliente, tipo de evento, producto/opción, staff, usuario asignado, motivo, etc.) se **resuelve antes de guardarlo** con una lectura acotada al tenant (`findById` del repository de esa entidad, con `tenantEq`). Si no existe en el tenant: `NOT_FOUND` con el código de dominio de esa entidad — exactamente el mismo error que un id inexistente, para no revelar que existe en otro tenant.
- Vale también para listas de ids (staff de un evento, líneas y opciones de una cotización) y para las tablas que no tienen `tenant_id` en la relación (`event_staff`: se resuelve el staff por el repository acotado).
- Los usuarios se resuelven por **membresía** en el tenant, no por la tabla `user` global.
- Con RLS (§12) esas lecturas acotadas devuelven cero filas para un id ajeno. Aun así la base no impide el cruce en las FK (§12.7): sigue siendo obligatorio resolver cada id.

### 11.5 Pruebas de aislamiento

- Por módulo: `modules/<module>/test/<module>.isolation.int.test.ts`, contra Postgres real (no mocks), usando `seedTwoTenants` de `src/test/db.ts`. Cubre, para **cada método** del repository, que el tenant A no lee ni modifica datos del tenant B, y por cada relación entre tablas, que insertar con un id del otro tenant es rechazado (§11.4).
- Se valida con mutación manual: quitar un `tenantEq` o un filtro del `ON` debe hacer fallar algún test; si no falla, falta una aserción.
- Correr: `pnpm --filter api test:int` (requiere `TEST_DATABASE_URL` de una base descartable; el harness se niega a correr contra una URL que no sea local). Los tests unitarios sin base: `pnpm --filter api test`.
- Tests siempre en subcarpetas `test/` (§3.6).

### 11.6 Datos compartidos y globales

- **Catálogo global `quote_stages`** (estructural, no pertenece a ningún tenant) + **overlay por tenant `quote_stage_settings`** (PK `(tenant_id, stage_id)`; `label`, `color`, `description` opcionales). Las lecturas hacen `LEFT JOIN` al overlay del tenant con `coalesce` a los valores globales; `config.updateQuoteStages` escribe **solo** el overlay. Ningún tenant puede escribir en `quote_stages`.
- **Tablas de auth globales** (`user`, `session`, `account`, `verification`) y `organization`/`member`: sin `tenant_id`. `platform_access_log` lleva `tenant_id` pero está exenta de la guarda por ser un log de plataforma.
- **Roles por organización** (`role`, `role_permission`, `role_audit_log`, con `tenant_id`): cada organización tiene sus roles; exactamente uno es el **dueño** (`is_owner`, índice único parcial), que no se edita, duplica ni borra y no guarda permisos (su poder es el bypass de `can`). Los roles base se siembran desde `ROLE_TEMPLATES` con el nombre de la plantilla (`Superadmin` = dueño, `Admin`, `Operator`, `Member`); después son roles comunes que la organización puede editar o renombrar. El módulo `roles` (`roles.*`, gateado por `role.read/create/update/delete`) valida contra `TENANT_PERMISSIONS`, usa `version` para la concurrencia optimista (`ROLE_VERSION_CONFLICT`), no deja borrar un rol en uso (`ROLE_IN_USE` con `memberCount`) y registra cada cambio en `role_audit_log`. **Regla de escalada:** quien no es dueño solo puede crear, editar, duplicar o borrar roles cuyos permisos tenga él mismo con alcance igual o mayor (`isWithinPower`, `ROLE_PRIVILEGE_ESCALATION`).
- **Usuarios compartidos entre organizaciones** (mismo email en varios tenants; la cuenta `user` es global, el rol es de cada membresía):
  - La visibilidad de usuarios en un tenant es por **membresía** (`member` con `organization_id = tenantId`); el rol visible es el de `member.role_id` (`{ id, name, isOwner }`). Los miembros con el rol dueño solo se listan a un dueño; para el resto responden como inexistentes (`NOT_FOUND`).
  - **Asignar rol:** `users.create`/`users.update` reciben `roleId`, que se resuelve dentro del tenant (un rol ajeno es `ROLE_NOT_FOUND`). Solo se puede asignar un rol que pase `canAssignRole` (`roles.service.ts`): el dueño cualquiera; el resto, un rol no dueño cuyos permisos estén dentro de su poder. `roles.assignable` (`guardedProcedureAnyOf({ user: [create] }, { user: [update] })`) devuelve exactamente esos roles, para que quien gestiona usuarios sin `role.read` pueda elegir uno. Nadie cambia su propio rol (`CANNOT_EDIT_OWN_ROLE`) y no se puede quitar el último dueño (`ROLE_LAST_OWNER`).
  - Quien no es dueño no puede actuar (cambiar rol, renombrar, borrar, regenerar enlace) sobre un miembro cuyo rol actual sea más fuerte que el suyo.
  - El nombre y las credenciales son globales: un admin de tenant **no** puede renombrar ni regenerar el enlace de un usuario con más de una membresía (`USER_IN_MULTIPLE_ORGANIZATIONS`) ni de un admin de plataforma (`USER_IS_PLATFORM_ADMIN`). El rol sí se puede cambiar: solo toca esta membresía.
  - Eliminar un usuario en un tenant quita su membresía (y revoca sus sesiones activas en esa organización), también si tiene otras membresías. La fila global `user` solo se borra si no le quedan membresías, no es admin de plataforma y no tiene filas en `platform_access_log` (la FK restringe el borrado para no perder la autoría de la auditoría; la cuenta queda sin organización).
  - `users.create` con un email que ya existe: si ya es miembro de este tenant, `USER_ALREADY_EXISTS`; si existe globalmente sin membresía aquí, solo un admin de plataforma puede adjuntarlo (los admins de tenant reciben `USER_ALREADY_EXISTS`, para no permitir tomar cuentas ajenas pre-registradas); no se toca su contraseña. Un email nuevo crea la cuenta con enlace de contraseña (`WEB_APP_URL`).
  - Las preferencias (`user_preferences`) son por `(tenant_id, user_id)`.
  - **Columnas heredadas:** `user.role` y `member.role` (texto) no autorizan. `user.role` solo lo escribe el plugin `admin` de Better Auth al registrarse una cuenta (`defaultRole`); `member.role` se sigue escribiendo con la clave del rol base equivalente (`legacyMemberRoleOf`, `member` para roles propios) porque la columna es `NOT NULL` y el plugin `organization` la lee. Se eliminarán en una fase posterior.
- Subidas a R2 con prefijo por tenant: `t/<tenantId>/event-payments/…` y `t/<tenantId>/products/<productId>/…` (imágenes de producto).

### 11.7 Seeds y alta de tenants

Ver §8.1 (`tenant:create`, `db:seed --demo=prod|local`, usuarios demo). Toda función `seedX` recibe `tenantId`, y los flags de `db:seed` ya documentados se mantienen. Los crons (`registerCrons(tenantId)`) no están conectados a `server.ts` en esta fase: los jobs se corren a mano, para una organización (`pnpm --filter api jobs:event-reminders -- --tenant=<slug>`) o para todas (`-- --all`, una transacción por organización; si una falla, las demás siguen).

### 11.8 Endurecimiento HTTP (`server.ts`)

- **Cabeceras** (`core/express/securityHeaders.ts`): sin `x-powered-by`. Se envían `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` y `Cross-Origin-Opener-Policy: same-origin`. La API solo sirve JSON, así que la CSP no afecta a la web. HSTS se envía solo con `NODE_ENV=production`.
- **Origen** (`core/express/originGuard.ts`, montado en `/trpc` y `/api/uploads`): un método que no sea `GET`/`HEAD`/`OPTIONS` se rechaza con 403 `FORBIDDEN_ORIGIN` cuando trae `Origin`, o `Referer` si no hay `Origin`, fuera de `WEB_ORIGIN`. Usa la misma lista que CORS (`isAllowedOrigin` de `cors.ts`). Las llamadas sin `Origin` ni `Referer` (servidor a servidor, scripts) pasan. `/api/auth` tiene su propio chequeo de Better Auth.
- **Lotes de tRPC:** `maxBatchSize: TRPC_MAX_BATCH_SIZE` (20, `core/trpc/batch.ts`). El `httpBatchLink` de la web usa `maxItems: 20`, y nunca puede ser mayor.
- **Caché de cookie de sesión:** `maxAge` de 60 s. El `middleware.ts` de la web la usa para redirigir (`mustChangePassword`); el rol no viaja en la cookie. tRPC y `guardTenantSession` la saltean (`disableCookieCache`).
- **`/update-user` por HTTP:** rechaza `image` (la web solo cambia `name`).

---

## 12. Row Level Security (segunda barrera)

Spec: `docs/superpowers/specs/2026-11-08-multitenant-fase1b-rls-design.md`. Runbook de despliegue: `docs/superpowers/runbooks/multitenant-cutover.md`. `tenantEq` sigue siendo obligatorio (§11.3): el RLS es la red de seguridad si una consulta lo olvida, no su reemplazo. Se recomienda **Postgres >= 15** (en versiones anteriores `public` concede `CREATE` a `PUBLIC` por defecto y `db:roles` no lo revoca); ningún código lo exige.

### 12.1 Roles y variables de conexión

| Rol | Atributos | Lo usa | Variable |
| --- | --- | --- | --- |
| `owner` | dueño de las tablas; debe tener `BYPASSRLS` o ser superusuario (requisito del administrador: ni `db:roles` ni `mt:verify` lo comprueban; las migraciones de datos cruzan organizaciones) | migraciones, `db:reset`, `db:baseline`, `db:roles`, `db:studio` | `DATABASE_OWNER_URL` |
| `app` | sin `SUPERUSER`, `BYPASSRLS` ni `CREATEROLE`; solo `SELECT/INSERT/UPDATE/DELETE` y secuencias | la API en cada petición, jobs | `DATABASE_APP_URL` |
| `platform` | `BYPASSRLS`; nunca atiende peticiones de usuarios | `db:seed`, `tenant:create`, `mt:verify` | `DATABASE_PLATFORM_URL` |

- `pnpm --filter api db:roles` (idempotente) crea `app` y `platform`, concede permisos y fija `ALTER DEFAULT PRIVILEGES` para las tablas que cree el dueño. Se conecta con `DATABASE_OWNER_URL` y toma el nombre y la contraseña de cada rol del usuario y la contraseña de `DATABASE_APP_URL` y `DATABASE_PLATFORM_URL` (decodificados como los decodifica el driver, así que la contraseña va codificada con `encodeURIComponent` si tiene `@ : / % ? #`…). Falla nombrando la variable si falta alguna de las dos URLs o si no trae usuario y contraseña, y si los usuarios coinciden entre sí o con el dueño. No imprime URLs ni contraseñas.
- `requireDatabaseUrl` (`db/databaseUrls.ts`) nunca cae a otra variable: un script sin su URL falla con un mensaje claro.
- **Verificación al arrancar** (`db/roleGuard.ts`): la API no arranca si el rol de `DATABASE_APP_URL` es superusuario, tiene `BYPASSRLS` o `CREATEROLE` (podría concederse un rol que salta el RLS) o es **miembro** (transitivo) de un rol que salta el RLS; `mt:verify` hace la misma comprobación. Los roles creados desde la consola de Neon pertenecen a `neon_superuser`: el rol `app` debe crearse con `db:roles`.
- Un administrador de plataforma (`user.isPlatformAdmin`) es una persona, no un rol de base: la API sigue usando `app` con una organización fijada, una a la vez.

### 12.2 Políticas

Para cada tabla con `tenant_id` (lista `TENANT_TABLES`, más `platform_access_log`), declaradas con `pgPolicy` en el schema Drizzle:

- `ENABLE` y `FORCE ROW LEVEL SECURITY` (el dueño tampoco las salta por serlo).
- Una sola política `FOR ALL` con `USING` y `WITH CHECK`: `tenant_id = current_setting('app.tenant_id', true)`.
- **Falla cerrado:** sin organización fijada `current_setting` es nulo, la comparación no es verdadera y no se ven filas ni se puede insertar.
- La migración `0005_tenant_rls.sql` se genera con `db:generate`; el `FORCE` se agrega a mano (Drizzle no lo genera). Al añadir una tabla de negocio nueva, su migración debe incluir `ENABLE`, `FORCE` y la política; la guarda `tenantTables.test.ts` y `mt:verify` lo comprueban.
- Las tablas de autenticación (`user`, `session`, `account`, `verification`, `invitation`, `organization`, `member`) **no** tienen RLS: Better Auth las lee durante el login, antes de que exista organización activa, y un usuario puede pertenecer a varias. Siguen protegidas por el código.

### 12.3 Transacción por petición

`protectedProcedure` (y `guardedProcedure*`) hace, en este orden:

1. `evaluateTenantAccess`: membresía, sobre tablas sin RLS y fuera de la transacción.
2. Si es un administrador de plataforma sin membresía, escribe la fila de auditoría en su **propia** transacción corta, antes de la de la petición (un fallo de la petición no la revierte y la petición no retiene una conexión mientras espera otra).
3. `withTenantTx(tenantId, …)`: abre la transacción y ejecuta `set_config('app.tenant_id', tenantId, true)`. Dentro resuelve el acceso (`resolveAccess`, porque `role`/`role_permission` tienen RLS) y ejecuta el procedure.
4. Éxito: `COMMIT`. Error: `ROLLBACK`.

El contexto que recibe el procedure añade:

- **`ctx.db`**: la transacción de la petición. `xModule(ctx)` construye los repositories con ella; las transacciones que abre un repository (`this.db.transaction`) son puntos de guardado dentro de la de la petición.
- **`ctx.runInTenant(fn)`**: abre una transacción corta independiente con el tenant fijado (`fn` recibe un `tx`).
- **`ctx.afterCommit(task)`**: encola una tarea que corre cuando la petición ya hizo `COMMIT` (se descarta si hay `ROLLBACK`; un fallo de la tarea se registra y no afecta la respuesta). Para trabajo en segundo plano que debe ver datos ya confirmados (ej. generar el PDF de una cotización recién creada).

**`withTenantTx(tenantId, fn, database?)`** (`db/tenantTx.ts`) es la única forma de fijar el tenant. Reglas:

- El `set_config` es **siempre transaction-local** (`is_local = true`). Prohibido a nivel de sesión (`false`): la conexión vuelve al pool con el tenant y lo filtraría a otra petición.
- Rechaza un `tenantId` vacío. El tenant sale de la sesión (`ctx.tenant.id`), nunca del `input`.
- Procedures sin organización (públicos, `authedProcedure`, `tenant.memberships`/`tenant.select`) no abren esta transacción y no tocan tablas con RLS.

### 12.4 Operaciones lentas: `shortTxProcedure` y patrón de tres fases

Cada petición con tenant retiene una conexión de principio a fin, así que una llamada externa lenta (servicio de PDF, subida a R2) no puede ocurrir dentro de esa transacción. Hoy: `quotes.generatePdf`, `quotes.regeneratePdf`, la subida de adjuntos de pago y la de imágenes de producto (que además procesa la imagen con `sharp` fuera de toda transacción).

- Usar **`guardedShortTxProcedure(permiso)`** (o `shortTxProcedure`): hace las mismas comprobaciones, pero no abre la transacción larga; `ctx.db` **no existe** y el service recibe `ctx.runInTenant`. `protectedProcedure` lanza un error si el procedure declara `shortTx`.
- Patrón de tres fases: (1) transacción corta que lee y valida (`runInTenant`); (2) llamada externa **sin** transacción abierta; (3) otra transacción corta que guarda el resultado. Si el guardado de la fase 3 falla tras haber subido un archivo, se borra el archivo (mejor esfuerzo) y se relanza el error original.
- Los repositories de esas rutas se construyen dentro de cada fase con el `tx` recibido (`(tx) => new XRepository(tx, tenantId)`); nunca capturar el `tx` de una fase en otra.
- Ver `modules/quotes/quotes.module.ts` (`quotesPdfModule`), `PaymentAttachmentUploader` en `modules/events/` y `ProductImageUploader` en `modules/products/`.

### 12.5 Rutas de Express

`guardTenantSession` replica la cadena de `shortTxProcedure`: sesión sin caché, organización, acceso en una transacción corta, auditoría de plataforma. No mantiene transacción durante el handler: expone `res.locals.runInTenant` y el controller abre transacciones cortas con él (mismo patrón de tres fases para la subida a R2).

### 12.6 Código que corre fuera de la cadena

- **Better Auth** usa su propio pool, `authDb` (`db/index.ts`, `DB_AUTH_POOL_MAX`, por defecto 3). Corre dentro de peticiones que ya retienen una conexión de `DB_POOL_MAX`; con el mismo pool podría quedarse esperando una conexión que nunca se libera. Solo toca tablas sin RLS. Código que corra dentro de una petición pero fuera de `ctx.db` (ej. `auth.api.signUpEmail` en `users.create`) debe usar `authDb`, no el pool principal.
- **Scripts que cruzan organizaciones** (`createTenant`, seeds, `mt:verify`) usan `platformDb()` (`db/platform.ts`, `DATABASE_PLATFORM_URL`); la API nunca lo importa.
- **Jobs** (`jobs:event-reminders -- --tenant=<slug>` o `-- --all`) usan `app` y abren una transacción por organización.
- **Pool:** `DB_POOL_MAX` (por defecto 10) dimensiona las transacciones de petición. Conexiones por instancia = `DB_POOL_MAX + DB_AUTH_POOL_MAX`; multiplicado por las instancias debe quedar por debajo del límite del plan de Postgres (dimensionado y prueba de carga en el runbook).

### 12.7 Brecha conocida: las FK se verifican sin RLS

Postgres comprueba las claves foráneas saltándose el RLS. Con el tenant A fijado, el rol `app` podría insertar una fila cuya FK de una sola columna apunte a una fila del tenant B (ej. `quotes.client_id` -> `clients.id`) y sondear su existencia. Hoy lo evita la resolución de ids por lecturas acotadas (§11.4), que con RLS devuelven cero filas para ids ajenos (ids uuid, difíciles de adivinar). La defensa estructural serían FK compuestas `(x_id, tenant_id) -> padre(id, tenant_id)` en ~29 tablas: **decisión aparcada** (migración aparte). Hasta entonces, no saltarse §11.4.

### 12.8 Pruebas

- Las pruebas de integración existentes conectan con un rol que se salta el RLS (prueban la lógica); el aislamiento lo prueban las suites con el rol `app`: `db/schema/test/rls.int.test.ts` (consulta sin filtro, sin tenant fijado, `INSERT`/`UPDATE`/`DELETE` ajenos, por cada tabla), la cadena completa por tRPC y la ruta de subida de Express, con roles de prueba propios (`src/test/roles.ts`, nombres distintos de los reales para no resetear sus contraseñas).
- `drizzle-kit push` (usado solo por el harness de integración sobre su base descartable) crea las políticas **sin** `USING`/`WITH CHECK` y nunca agrega `FORCE`; por eso `src/test/rlsPolicies.ts` las reescribe en el global setup. Producción y desarrollo usan migraciones, no `push`.
- `modules/test/noGlobalDb.test.ts` falla si un archivo de `modules/` importa el `db` global (cualquier forma de import, re-export o `require`).
- `mt:verify` (con `DATABASE_PLATFORM_URL`) comprueba que cada tabla con `tenant_id` tiene RLS habilitado, forzado y con su política, y, si `DATABASE_APP_URL` está definida, que el rol de la API no se salta el RLS.

---

## 13. Módulos y add-ons por organización (features)

Spec: `docs/superpowers/specs/2026-11-13-multitenant-fase4a-features-design.md`. Cada organización tiene su propia lista de **módulos** y **add-ons** contratados. Decisiones de diseño: **no hay planes** (el administrador de plataforma activa las features una a una por organización), el **precio es solo informativo** (ninguna lógica cobra) y las funciones experimentales ("labs") quedan fuera de alcance.

### 13.1 Catálogo (`@repo/guards`)

- `packages/guards/src/features/registry.ts`: `FEATURES` (`Record<FeatureKey, { kind, requires }>`), con `kind` `core` | `module` | `add-on` (`'addon'` en el código). `FEATURE_KEYS`, `isFeatureKey(value)` e `isToggleable(key)` (`false` para las `core`).
- Claves: `core` = `auth`, `users`, `roles`, `settings`, `clients`, `catalog`, `dashboard`, `support`; `module` = `quotes`, `events`, `notifications`; `addon` = `priceTiers`, `configurableOptions`. **`events` requiere `quotes`** (un evento nace de una cotización aceptada: `events.quote_id` es `NOT NULL`).
- Las `core` están siempre activas, no tienen fila en la base y no se pueden modificar.
- `resolveFeatures(rows, now)` (`resolve.ts`, pura): una feature está activa si `enabled`, no venció (`expires_at` `NULL` o posterior a `now`) y todas las que requiere están activas. Devuelve el conjunto de `FeatureKey` activas, núcleo incluido.
- `resourceModules.ts`: `RESOURCE_MODULE` asocia recursos de permisos a un módulo (`quote`, `pipeline` y los de configuración de cotizaciones → `quotes`; `event`, `payment`, `staff`, `event_type`, `reschedule_reason` → `events`) y `moduleOfResource(resource)` lo consulta. Es lo que hace automático el guard de módulos (§13.4).
- Los schemas Zod de la respuesta de `features.mine` están en `packages/schemas/src/features.ts` (`myFeaturesSchema`).

### 13.2 Modelo de datos y RLS

- `db/schema/features.ts`: **`tenant_features`** (PK `tenant_id` + `feature_key`; `enabled`, `activated_at`, `expires_at` con `NULL` = permanente, `updated_at`; `price_cents`, `billing_period`, `currency` informativos) y **`tenant_feature_events`** (historial: acción `enabled | disabled | updated`, `before`/`after` en JSON, `actor`, `created_at`).
- **`tenant_features` es de solo lectura para `app`:** `tenantReadPolicy(table)` (`db/rls/policy.ts`) declara una única política `FOR SELECT` (`tenant_features_tenant_read`). Sin política de escritura, con RLS forzado, un `INSERT` del rol `app` falla y un `UPDATE`/`DELETE` afecta 0 filas, aunque `db:roles` le conceda los permisos de tabla. Solo escribe el rol `platform` (`BYPASSRLS`).
- **`tenant_feature_events`:** RLS habilitado y forzado, **sin política**: `app` no ve ni escribe nada.
- Ambas tablas están en `PLATFORM_MANAGED_TABLES` (`db/rls/policy.ts`) y **fuera de `TENANT_TABLES`**, que asume la política `FOR ALL` de §12.2. Tienen sus propias comprobaciones en `mt:verify` y en `db/rls/test/features.rls.int.test.ts`.
- **`products.price`:** entero nullable en centavos, **por unidad**. Un producto es *cotizable* si tiene `price` o si `priceTiers` está activo y tiene al menos un tier.
- Migración `drizzle/0006_tenant_features.sql`: ver el runbook (sección 8).
- Una tabla nueva de este tipo (que escribe solo `platform`) se añade a `PLATFORM_MANAGED_TABLES`, **no** a `TENANT_TABLES`, y lleva su comprobación en `mt:verify`.

### 13.3 Contexto y caché

- `ctx.features` (`ReadonlySet<FeatureKey>`, núcleo incluido) se resuelve en la cadena tRPC (`core/trpc/trpc.ts`, tipo en `core/trpc/tenantCtx.ts`) junto a `ctx.db`/`ctx.runInTenant`. Se lee con el rol `app` (`lib/features/repository.ts`, `loadTenantFeatures`), dentro de la transacción de la petición (como punto de guardado) o en una transacción corta en las rutas `shortTx`.
- **Caché** (`lib/features/cache.ts`, `getTenantFeatures`): en memoria, **por organización**, TTL `FEATURE_CACHE_TTL_MS` = 30 s. Guarda las **filas**, no el conjunto resuelto, para que un vencimiento dentro del TTL se aplique a tiempo.
- **Falla cerrado:** si la lectura falla, la petición sigue con **solo el núcleo** activo, el error se registra y **no se cachea** (la siguiente petición reintenta).
- `clearFeatureCache(tenantId?)` vacía una organización o toda la caché (lo usan las pruebas).
- **Consecuencia operativa:** los scripts (§13.6) son otro proceso y no invalidan la caché de la API. Un cambio hecho con `feature:set`/`feature:unset` se aplica **en hasta 30 s**. Una fase posterior añadirá un endpoint de plataforma que invalide al instante.

### 13.4 Bloqueo: módulos automáticos, add-ons explícitos

- **Módulos, automático (solo mutaciones).** `guardedProcedure`, `guardedShortTxProcedure` y `guardedProcedureAnyOf` (`core/trpc/trpc.ts`) validan el permiso del rol y además que el módulo del recurso (`moduleOfResource`) esté activo. En `guardedProcedureAnyOf` el error nombra el módulo solo si **todos** los checks que el rol cumple caen sobre módulos inactivos. Un procedure nuevo con `guardedProcedure({ [RESOURCES.QUOTE]: [...] })` queda gateado sin código extra.
- **Add-ons y otros casos, explícito.** `requireFeature(key)` (`core/trpc/requireFeature.ts`) es un middleware que se encadena con `.use(...)`. Hoy gatea `priceTiers` y `configurableOptions` en `modules/products/products.router.ts` y `modules/events/events.router.ts`, y `notifications` en `modules/notifications/notifications.router.ts` (procedures sin recurso de permiso propio).
- **Regla "ocultar y conservar": solo mutaciones.** Las mutaciones sobre un módulo apagado se rechazan; las consultas pasan, así que los datos ya guardados se conservan y siguen legibles, y vuelven a operar al reactivar. La web impide el acceso a la pantalla (docs/frontend/architecture.md §9.4).
- **Excepciones conscientes** a la regla (decididas, no omisiones):
  1. Los servicios insertan notificaciones como efecto secundario aunque `notifications` esté apagado.
  2. El job de recordatorios (`jobs/eventReminders.job.ts`) omite a las organizaciones con `events` o `notifications` inactivos (además de exigir `configurableOptions`).
- **Error:** `FEATURE_NOT_ENABLED` (`ErrorCodes.feature.NOT_ENABLED`), `FORBIDDEN` con `AppError` de HTTP 403 y `{ feature }` en los datos (`featureNotEnabled(feature)`).
- **Rutas de Express:** `guardTenantSession` (`core/express/middleware/guardTenantSession.ts`) aplica la misma regla a la subida de adjuntos: los métodos que no son lectura responden 403 con `{ errorCode: 'FEATURE_NOT_ENABLED' }` si el módulo está inactivo.
- **Por qué `requireFeature` usa una segunda instancia de `initTRPC`:** el middleware se construye con su propio `initTRPC.context<{ features }>()` porque `trpc.ts` importa `requireFeature.ts` (para `featureNotEnabled` e `inactiveModuleOf`); importar de vuelta la instancia de `trpc.ts` crearía un ciclo de imports. El contexto que declara es solo `{ features }`, que es lo que la cadena tenant ya aporta.
- **Reglas de dominio ligadas a features:**
  - Productos: con `priceTiers` apagado, un `create`/`update` con tiers no vacíos responde `FEATURE_NOT_ENABLED`; una lista vacía no falla y deja lo guardado intacto (`products.service.ts`).
  - Cotizaciones: sin tiers, el subtotal de una línea se valida contra `products.price × quantity`; un producto sin precio ni tiers activos responde `PRODUCT_NOT_QUOTABLE` (`ErrorCodes.product.NOT_QUOTABLE`, `quotes.service.ts`). Solo se revalidan las líneas nuevas o modificadas (`changedLines`, `quotes.validation.ts`): las cotizaciones existentes conservan su precio congelado.
  - Con `configurableOptions` apagado, los ajustes de opciones se ignoran en la lógica pero conservan su valor.
  - Cotizaciones: sin `events` activo, `quotes.approve` confirma la cotización y no crea el evento derivado; activar `events` después no lo crea retroactivamente (`QuotesService.approve`, `QuotesRepository.approve` con `eventData` nulo).

### 13.5 Endpoint `features.mine`

`modules/features/` (`features.router.ts`, `features.service.ts`, `features.module.ts`): `features.mine`, `protectedProcedure` (cualquier miembro de la organización), devuelve las features activas y su vencimiento a partir de `ctx.features`. La web lo usa para decidir qué mostrar (`docs/frontend/architecture.md` §9.4); las features no viajan en la sesión.

### 13.6 Administración: servicio y scripts

`lib/features/admin.ts` (`setFeature`, `unsetFeature`, `listFeatures`) es el servicio compartido; corre sobre el rol `platform` y, en una sola transacción que bloquea la fila de la organización: valida la clave contra el catálogo (`FEATURE_UNKNOWN_KEY`), rechaza las `core` (`FEATURE_NOT_TOGGLEABLE`), valida dependencias, escribe `tenant_features` y registra el cambio en `tenant_feature_events`.

- Activar `events` sin `quotes` activo falla (`FEATURE_MISSING_DEPENDENCY`); desactivar `quotes` con `events` activo también (`FEATURE_HAS_DEPENDENTS`, nombra a las dependientes). **Activar `quotes` antes que `events`.**
- Desactivar deja la fila con `enabled = false` para conservar precio y fechas. Los campos no indicados al re-activar conservan su valor.

```bash
pnpm --filter api feature:list  --tenant <slug>
pnpm --filter api feature:set   --tenant <slug> --key <key> [--expires YYYY-MM-DD] [--price <cents>] [--period monthly|yearly] [--currency USD]
pnpm --filter api feature:unset --tenant <slug> --key <key>
```

- `--expires` es el **último día activo**: se guarda el inicio del día siguiente en UTC.
- Para borrar un valor guardado: `--expires never` deja la feature permanente (`expires_at` en `NULL`) y `--price none`, `--period none`, `--currency none` ponen esa columna en `NULL`; omitir la opción conserva el valor. `never`/`none` no son válidos en otras opciones.
- `--price` es un entero en centavos; `--period` es `monthly` o `yearly` (`BILLING_PERIODS`); `--currency` es un código ISO de 3 letras.
- Los scripts (`db/scripts/feature.ts`) usan `DATABASE_PLATFORM_URL`; el actor del historial es el usuario del sistema operativo.
- El seed de demo (`seedDemoFeatures`, `db/seeds/demo.ts`) activa todas las features activables. `tenant:create` **no** activa ninguna: una organización nueva nace solo con el núcleo (runbook, sección 8).

### 13.7 Verificación y pruebas

- `mt:verify` comprueba que `tenant_features` tiene RLS habilitado y forzado con la única política `tenant_features_tenant_read`, que `tenant_feature_events` tiene RLS y ninguna política, que ambas tablas existen (si falta una, la reporta como problema), que ninguna fila tiene una clave `core` o desconocida y que ninguna organización tiene `events` activo sin `quotes`.
- Pruebas: catálogo (`packages/guards/src/features/test`), caché (`lib/features/test/cache.test.ts`), servicio (`lib/features/test/admin.int.test.ts`), RLS (`db/rls/test/features.rls.int.test.ts`), guards (`core/trpc/test/featureGuards.int.test.ts`, `core/express/middleware/test/guardTenantSession.features.int.test.ts`) y `modules/features/test`.

### 13.8 Receta — Añadir una feature nueva

1. **Registro:** entrada en `DEFINITIONS` de `packages/guards/src/features/registry.ts` (`kind`, `requires`); un `core` no puede requerir una no-core (lo valida un test del catálogo).
2. **Bloqueo en la API:** si es un módulo con recursos de permisos propios, mapear cada recurso en `RESOURCE_MODULE` (`resourceModules.ts`) y el guard se aplica solo. Si es un add-on o el endpoint no tiene recurso asociado, `.use(requireFeature('<key>'))` en cada mutación afectada. No bloquear consultas.
3. **Web:** `feature: '<key>'` en el ítem de `lib/navigation/constants/items.ts` y, si hace falta, en `ROUTE_PATTERNS`; `useFeature`/`<Feature>` en los controles de add-ons (docs/frontend/architecture.md §9.4).
4. **i18n es/en:** el nombre en `features.<key>` de `locales/{es,en}/common.json`.
5. **Tests:** catálogo (dependencias), guard o `requireFeature` (mutación bloqueada, consulta no), y web si hay gating de UI. Si la feature añade datos nuevos por organización, aplicar §11 como siempre.
6. **Organizaciones existentes:** una feature nueva no tiene fila en ninguna, así que nace apagada. Para darla a organizaciones que ya la usaban, activarla con `feature:set` o con una migración de datos.
