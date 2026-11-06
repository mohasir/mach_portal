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
| Auth | **Better Auth** (plugins `admin` para RBAC y `organization` para tenants/membresías) |
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
export const protectedProcedure = tenantProcedure.use(/* membresía o admin de plataforma; deja ctx.tenantId */);

// Sesión + permiso. Evalúa el rol contra @repo/guards (sin ir a DB).
export function guardedProcedure(permissions: PermissionCheck) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = (ctx.user as { role?: string | null }).role;
    if (!hasPermission(role, permissions)) throw new TRPCError({ code: 'FORBIDDEN' });
    return next();
  });
}
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

- Catálogo único en **`@repo/guards`** (`statements`/`ac`/`roles`/`hasPermission`), consumido por BE y FE.
- Backend: `lib/auth.ts` registra el plugin `admin({ ac, roles, defaultRole: DEFAULT_ROLE, adminRoles: ADMIN_ROLES })`; los procedures usan `guardedProcedure(permiso)`.
- **Recursos de dominio** se referencian con las constantes tipadas `RESOURCES`/`ACTIONS`: `guardedProcedure({ [RESOURCES.X]: [ACTIONS.READ] })`. **Nunca** literales sueltos.
- **Excepción:** los statements nativos de Better Auth (los que no son recursos de dominio) no tienen constante en `RESOURCES` — se referencian por su literal.
- Detalle del catálogo compartido y `hasPermission`: `docs/frontend/architecture.md` §Autorización (misma fuente de verdad).

---

## 8. Base de datos (Drizzle)

- Cliente en `db/index.ts` (`export const db`, `export type Database`); se inyecta al repository por constructor (testeable).
- Schema en `db/schema/` (barrel `index.ts`). `auth.ts` lo genera/gestiona Better Auth; tablas de dominio se agregan aparte y se reexportan en el barrel.
- **Flujo de esquema (migraciones versionadas en `apps/api/drizzle/`):** cambiar el schema TS → `pnpm --filter api db:generate` → revisar (y si hace falta editar a mano) el SQL generado y commitearlo → `pnpm --filter api db:migrate`. Después de generar, `db:generate` debe responder "No schema changes" y `pnpm --filter api exec drizzle-kit check` "Everything's fine". No hay script `db:push`: solo el harness de integración usa `drizzle-kit push --force`, sobre su base descartable.
  - **Bases creadas con `push`** (sin filas en `drizzle.__drizzle_migrations`): ejecutar **una vez** `pnpm --filter api db:baseline` para registrar la migración `0000` como aplicada; si no, `db:migrate` intentaría recrear las tablas existentes. Se niega a correr si ya está registrada.
  - `pnpm --filter api mt:verify [--pre]` verifica el estado multi-tenant (conteos por tabla, filas sin `tenant_id`, huérfanas, duplicados, membresías); solo hace `SELECT`. Runbook de cutover: `docs/superpowers/runbooks/multitenant-cutover.md`.
  - Una migración con datos debe ser transaccional y fallar con un mensaje claro si falta un parámetro (`db:migrate --set clave=valor`, que viaja por la conexión directa, no por un pooler).
  - `db:fresh` = reset + migrate + seed local de demostración (`--demo=local`).
- Borrados: definir `onDelete: 'cascade'` en las FKs cuando corresponda.

### 8.1 Alta de tenants y semillas

- **Alta de un tenant:** `pnpm --filter api tenant:create --slug=<slug> --name=<nombre> --admin-email=<email> --admin-name=<nombre>`
  (llama a `createTenant` de `lib/tenancy/createTenant.ts`). Valida el slug (se pasa a minúsculas),
  crea la organización, siembra los defaults del tenant (`seedTenantDefaults`: config, tipos de
  evento, motivos de reprogramación, catálogo base, plantilla de PDF) y agrega al primer admin como
  miembro `admin`. Si el email es nuevo imprime un enlace de contraseña (24 h); si la cuenta ya
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

  | Email | Rol |
  | --- | --- |
  | `superadmin@norte.demo` / `superadmin@sur.demo` | `superadmin` |
  | `admin@norte.demo` / `admin@sur.demo` | `admin` |
  | `operator@norte.demo` / `operator@sur.demo` | `operator` |
  | `member1@…`, `member2@…` (`norte.demo` / `sur.demo`) | `member` |
  | `shared@demo.test` | miembro de ambos: `operator` en Norte, `member` en Sur (rol global `operator`, que es el que autoriza en esta fase) |
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
9. **Guards**: agregar el recurso a los `statements` de `@repo/guards` y a los roles que correspondan.
10. **Aislamiento**: test `modules/<module>/test/<module>.isolation.int.test.ts` con `seedTwoTenants` (§11.5).

Con esto, el front puede inferir `RouterOutputs['<module>']['list']` y construir su feature (ver `docs/frontend/architecture.md`).

---

## 10. Anti-patrones (qué NO hacer)

- ❌ Devolver la fila cruda de Drizzle en vez de pasarla por `<module>.resource.ts`.
- ❌ Tocar `db` directo desde el service o el router (solo el repository habla con Drizzle).
- ❌ Poner reglas de negocio en el repository (van en el service).
- ❌ Aceptar un `sortBy` sin whitelist (`sortColumns`) — habilita ordenar por columnas arbitrarias.
- ❌ Armar un patrón `like`/`ilike` con texto del usuario a mano (`` `%${search}%` ``): usar `containsPattern(search)` (`lib/utils/search.ts`), que escapa `%`, `_` y `\`.
- ❌ Chequear permisos con `if (role === 'admin')` en vez de `guardedProcedure` + `@repo/guards` (con `RESOURCES`/`ACTIONS`).
- ❌ Lanzar strings/errores crudos: usar `TRPCError` con `cause: new AppError(ErrorCodes...)` para errores de dominio.
- ❌ Escribir DTOs de respuesta a mano: el `resource` es el shape y el front lo infiere del router.
- ❌ Devolver listas sin `Paginated` / sin `paginationMeta`.
- ❌ Una query a una tabla con `tenant_id` sin `tenantEq` (incluye subqueries, `JOIN ... ON`, `EXISTS` y las consultas hechas con el handle de una transacción).
- ❌ Leer `tenantId` de un `input`, del cuerpo, de una cabecera o de la URL; o dejar que un `set(...)`/`values(...)` reciba un `tenantId` de afuera.
- ❌ Guardar un id recibido por `input` (`clientId`, `eventTypeId`, `assigneeId`…) sin resolverlo antes con una lectura acotada al tenant.
- ❌ Instanciar un repository o service a nivel de módulo (fuera de `xModule(ctx)`): existiría sin tenant.
- ❌ Escribir una ruta de Express fuera de tRPC sin `guardTenantSession`, o montarla fuera del `originGuard` de `server.ts` (rechaza métodos que cambian estado con un `Origin`/`Referer` que no está en `WEB_ORIGIN`).
- ❌ Editar una migración ya aplicada, o cambiar el schema sin generar su migración.
```

---

## 11. Multi-tenant

Una sola instalación y un solo dominio; los datos de cada cliente (tenant) conviven en las mismas tablas, separados por `tenant_id`. El tenant de una petición es la **organización activa de la sesión** (plugin `organization` de Better Auth); `organization.id` es el `tenantId` y `organization.slug` su identificador estable. El aislamiento de la fase 1 es por filtros explícitos en cada query; el RLS de Postgres como segunda barrera es la fase 1b. Spec: `docs/superpowers/specs/2026-10-19-multitenant-fase1-design.md`.

### 11.1 Cadena de procedures

```text
createContext      → sesión (sin caché de cookie) → organización activa → ctx.tenant (o null)
authedProcedure    → exige sesión                                   (solo tenant.memberships / tenant.select)
tenantProcedure    → exige organización activa: TENANT_NOT_SELECTED / TENANT_NOT_FOUND
protectedProcedure → exige membresía (o isPlatformAdmin) y mustChangePassword resuelto; deja ctx.tenantId
guardedProcedure   → permisos del rol (@repo/guards), como siempre
```

- La membresía se **re-verifica en cada petición** (`lib/tenancy/access.ts`, `evaluateTenantAccess`), así que sacar a alguien de la organización surte efecto en la petición siguiente. Solo la fila de la organización (nombre, existencia) se cachea ~60 s en memoria (`lib/tenancy/tenantResolver.ts`).
- Las rutas de Express fuera de tRPC (hoy `/api/uploads/event-payments`) usan el middleware `guardTenantSession` (`core/express/middleware/`), que aplica las mismas reglas con la misma función de decisión. Una ruta nueva fuera de tRPC **debe** usarlo.
- La superficie HTTP de Better Auth está recortada: `/sign-up/email` y los endpoints de los plugins `organization` y `admin` se bloquean por HTTP; las llamadas internas (`auth.api.*`) siguen funcionando. El alta de usuarios y organizaciones pasa por `users.create` y `tenant:create`.
- **Login:** global (email + contraseña). Un gancho de sesión fija la organización activa: con una membresía se activa sola; con varias queda sin activa hasta `tenant.select`; sin ninguna se rechaza con `USER_NO_ORGANIZATION` (el admin de plataforma sin membresías sí entra). La web nunca lee la organización activa de `useSession`: usa `tenant.active`.
- **Admin de plataforma** (`user.isPlatformAdmin`): puede seleccionar cualquier organización y entra con permisos de `superadmin` si no es miembro. Todo acceso sin membresía queda en `platform_access_log` (la primera query de cada sesión y tenant, y **todas** las mutaciones); la web muestra el aviso "modo plataforma". Un admin de plataforma que además es miembro no se audita, por eso `createTenant` rechaza (`USER_IS_PLATFORM_ADMIN`) un admin inicial que lo sea.

### 11.2 Factory `xModule(ctx)`

Ningún repository ni service existe sin tenant: se construyen por request desde el contexto.

```ts
// modules/<module>/<module>.module.ts
import { db } from '../../db';
import type { TenantCtx } from '../../core/trpc/tenantCtx';
import { XRepository } from './<module>.repository';
import { XService } from './<module>.service';

export function xModule(ctx: TenantCtx) {
  return new XService(new XRepository(db, ctx.tenantId));
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

### 11.5 Pruebas de aislamiento

- Por módulo: `modules/<module>/test/<module>.isolation.int.test.ts`, contra Postgres real (no mocks), usando `seedTwoTenants` de `src/test/db.ts`. Cubre, para **cada método** del repository, que el tenant A no lee ni modifica datos del tenant B, y por cada relación entre tablas, que insertar con un id del otro tenant es rechazado (§11.4).
- Se valida con mutación manual: quitar un `tenantEq` o un filtro del `ON` debe hacer fallar algún test; si no falla, falta una aserción.
- Correr: `pnpm --filter api test:int` (requiere `TEST_DATABASE_URL` de una base descartable; el harness se niega a correr contra una URL que no sea local). Los tests unitarios sin base: `pnpm --filter api test`.
- Tests siempre en subcarpetas `test/` (§3.6).

### 11.6 Datos compartidos y globales

- **Catálogo global `quote_stages`** (estructural, no pertenece a ningún tenant) + **overlay por tenant `quote_stage_settings`** (PK `(tenant_id, stage_id)`; `label`, `color`, `description` opcionales). Las lecturas hacen `LEFT JOIN` al overlay del tenant con `coalesce` a los valores globales; `config.updateQuoteStages` escribe **solo** el overlay. Ningún tenant puede escribir en `quote_stages`.
- **Tablas de auth globales** (`user`, `session`, `account`, `verification`) y `organization`/`member`: sin `tenant_id`. `platform_access_log` lleva `tenant_id` pero está exenta de la guarda por ser un log de plataforma.
- **Usuarios compartidos entre organizaciones** (mismo email en varios tenants; `user.role` es global en la fase 1):
  - La visibilidad de usuarios en un tenant es por **membresía** (`member` con `organization_id = tenantId`); el rol visible es `member.role`.
  - Un admin de tenant **no** puede cambiar el rol, el nombre ni regenerar el enlace de un usuario con más de una membresía (`USER_IN_MULTIPLE_ORGANIZATIONS`), ni de un admin de plataforma (`USER_IS_PLATFORM_ADMIN`); solo un admin de plataforma.
  - Eliminar un usuario en un tenant quita su membresía (y revoca sus sesiones activas en esa organización). Si el usuario tiene más de una membresía, solo un admin de plataforma puede eliminarlo (un admin de tenant recibe `USER_IN_MULTIPLE_ORGANIZATIONS`). La fila global `user` solo se borra si no le quedan membresías, no es admin de plataforma y no tiene filas en `platform_access_log` (la FK restringe el borrado para no perder la autoría de la auditoría; la cuenta queda sin organización).
  - `users.create` con un email que ya existe: si ya es miembro de este tenant, `USER_ALREADY_EXISTS`; si existe globalmente sin membresía aquí, solo un admin de plataforma puede adjuntarlo (los admins de tenant reciben `USER_ALREADY_EXISTS`, para no permitir tomar cuentas ajenas pre-registradas); no se toca su contraseña. Un email nuevo crea la cuenta con enlace de contraseña (`WEB_APP_URL`).
  - Las preferencias (`user_preferences`) son por `(tenant_id, user_id)`.
- Subidas a R2 con prefijo por tenant: `t/<tenantId>/event-payments/…`.

### 11.7 Seeds y alta de tenants

Ver §8.1 (`tenant:create`, `db:seed --demo=prod|local`, usuarios demo). Toda función `seedX` recibe `tenantId`, y los flags de `db:seed` ya documentados se mantienen. Los crons (`registerCrons(tenantId)`) no están conectados a `server.ts` en esta fase: los jobs son por tenant (`pnpm --filter api jobs:event-reminders --tenant=<slug>`) y nada itera sobre tenants todavía.

### 11.8 Endurecimiento HTTP (`server.ts`)

- **Cabeceras** (`core/express/securityHeaders.ts`): sin `x-powered-by`. Se envían `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` y `Cross-Origin-Opener-Policy: same-origin`. La API solo sirve JSON, así que la CSP no afecta a la web. HSTS se envía solo con `NODE_ENV=production`.
- **Origen** (`core/express/originGuard.ts`, montado en `/trpc` y `/api/uploads`): un método que no sea `GET`/`HEAD`/`OPTIONS` se rechaza con 403 `FORBIDDEN_ORIGIN` cuando trae `Origin`, o `Referer` si no hay `Origin`, fuera de `WEB_ORIGIN`. Usa la misma lista que CORS (`isAllowedOrigin` de `cors.ts`). Las llamadas sin `Origin` ni `Referer` (servidor a servidor, scripts) pasan. `/api/auth` tiene su propio chequeo de Better Auth.
- **Lotes de tRPC:** `maxBatchSize: TRPC_MAX_BATCH_SIZE` (20, `core/trpc/batch.ts`). El `httpBatchLink` de la web usa `maxItems: 20`, y nunca puede ser mayor.
- **Caché de cookie de sesión:** `maxAge` de 60 s. El `middleware.ts` de la web la usa para redirigir (rol, `mustChangePassword`). tRPC y `guardTenantSession` la saltean (`disableCookieCache`).
- **`/update-user` por HTTP:** rechaza `image` (la web solo cambia `name`).
