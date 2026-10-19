# Multi-tenant Fase 1 (núcleo de tenancy) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir Mach Portal en una app multi-tenant (un subdominio por cliente, datos aislados por `tenant_id`) y migrar al cliente actual como tenant #1, sin RLS (fase 1b).

**Architecture:** Plugin `organization` de Better Auth con usuario global y membresías; el tenant se resuelve por host (Next lo reenvía a la API con un header interno firmado) y viaja en `ctx.tenantId`; cada módulo construye sus servicios por request con repositorios que exigen `tenantId` y filtran con `tenantEq` en toda consulta; el proyecto adopta migraciones versionadas de Drizzle (línea base `0000` = esquema actual de `main`) y la migración del tenant #1 es la `0001`, con backfill de datos y un verificador.

**Tech Stack:** Express 5, tRPC v11, Drizzle (postgres-js), Better Auth 1.6, Zod 4, Vitest, Next.js 15 (middleware), pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-10-19-multitenant-fase1-design.md`

## Global Constraints

- Rama: partir de `multitenant`; sin worktrees; **nunca `git push`**; **preguntar al usuario antes de cada commit** (CLAUDE.md): cada tarea termina en un *checkpoint* que muestra `git status` y espera OK. Mensajes de commit en inglés, con la línea `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Comentarios de código en inglés y solo cuando explican un *porqué* no obvio; sin referencias al chat.
- Nunca leer archivos `.env`; nunca levantar servidores (`pnpm dev`) ni probar en vivo. `pnpm --filter api check-types` y `pnpm --filter web check-types` se pueden correr libremente.
- Las pruebas de integración (`*.int.test.ts`) necesitan un Postgres de prueba (`TEST_DATABASE_URL`, p. ej. el de `docker-compose.yaml`) que **levanta el usuario**; si no está disponible, dejar el comando documentado y pedirle que las corra.
- Frontend: leer antes `docs/frontend/architecture.md` y `docs/frontend/styling-guide.md`; mobile-first, AntD v6 + Tailwind, `lucide-react`, i18n es/en.
- Backend: seguir `docs/backend/architecture.md` (resource → repository → service → router, `guardedProcedure`, `AppError`/`ErrorCodes`).
- Migraciones versionadas (decisión nueva, reemplaza al `db:push` documentado en `docs/backend/architecture.md`): carpeta `apps/api/drizzle/`, línea base `0000` generada desde el esquema de `main` y marcada como aplicada en las bases creadas con `push` (prod y staging actual), y una sola migración `0001` para toda la fase 1, generada en la Tarea 18 y editada a mano. El migrador de Drizzle aplica todo lo pendiente en una sola transacción. La base de pruebas (desechable) sigue usando `drizzle-kit push`; la equivalencia entre migraciones y esquema TS se verifica en la Tarea 18. Hasta la Tarea 18, en desarrollo local de esta rama se usa `db:push`.
- Valores del spec: sesión por host sin `Domain`; slugs reservados `admin, www, api, app, staging` (más los que el plan agregue en `RESERVED_SLUGS`); caché de organización ~60 s; error de login para no-miembros = el mismo de credenciales inválidas; `APP_BASE_DOMAIN` (dev: `localhost:3000`); header interno `x-internal-key`; numeración de cotizaciones con `pg_advisory_xact_lock` por tenant.
- Fuera de alcance: RLS, roles de BD, transacción por request (1b); roles en BD (2); branding (3); planes y panel (4); FK compuestas; dominios propios; crons.

## Review Focus

1. Un email que ya existe en otro tenant se agrega como miembro nuevo (sin conflicto, sin resetear contraseña ni `mustChangePassword`) — Tarea 15.
2. Normalización del host: mayúsculas, puerto, punto final, `www`, `slug.localhost` — Tarea 2.
3. Un id de otro tenant dentro del `input` o de la URL (p. ej. `paymentId` en la subida de adjuntos) responde "no encontrado", nunca inserta — Tareas 9–15.
4. Un tenant recién creado sin filas de `app_settings`/`state_settings` no rompe `config.get` ni la creación de cotizaciones — Tarea 16.
5. Fallar a mitad de la migración no deja datos a medias (transaccional), re-ejecutarla no hace nada, y sobre una base vacía (desarrollo, `db:fresh`) no exige slug ni crea un tenant fantasma — Tarea 18.

---

### Task 0: Rama de trabajo

**Files:** ninguno.

- [ ] **Step 1:** Verificar `git branch --show-current` = `multitenant` y árbol limpio; crear `feat/mt-fase-1-tenancy` desde ahí (`git checkout -b`). Avisar al usuario antes de cambiar de rama si `git status` muestra cambios ajenos (otras sesiones comparten el árbol).

---

### Task 0b: Migraciones versionadas — línea base

**Files:**
- Create: `apps/api/drizzle/` (generada), `apps/api/src/db/scripts/migrate.ts`, `apps/api/src/db/scripts/markBaseline.ts`, `apps/api/src/db/scripts/markBaseline.int.test.ts`
- Modify: `apps/api/package.json` (scripts `db:migrate`, `db:baseline`)

**Interfaces (Produces):**
- `migrate.ts`: aplica las migraciones pendientes de `apps/api/drizzle` con el migrador de `drizzle-orm/postgres-js/migrator` usando `DATABASE_URL`; acepta `--set key=value` (repetible) que se pasa como parámetro de arranque de la conexión (`options: '-c key=value'`), para que el SQL lea `current_setting('key')` (lo usa la Tarea 18). **Verificar** con una prueba que el migrador corre todas las pendientes en una sola transacción (una migración que falla en la segunda deja la primera sin aplicar).
- `markBaseline.ts`: crea `drizzle.__drizzle_migrations` si no existe e inserta la fila de `0000` (hash y `created_at` tomados del `meta/_journal.json`); **se niega** si la tabla ya tiene filas o si la base no contiene las tablas de la línea base.

- [ ] **Step 1:** Generar la línea base desde el esquema de `main`: copiar `git show main:apps/api/src/db/schema/*` a un directorio temporal, escribir una config temporal de `drizzle-kit` que apunte a él y a `out: apps/api/drizzle`, y correr `drizzle-kit generate --name=baseline`. Verificar que el SQL resultante coincide con la base actual de `main` (`drizzle-kit push` de `main` sobre una base vacía no debe mostrar diferencias contra aplicar `0000`).
- [ ] **Step 2:** Tests (int): `markBaseline` + `migrate` sobre una base creada con la línea base y con datos → no ejecuta nada y conserva los datos; sobre una base vacía, `migrate` crea el esquema completo; `markBaseline` se niega en una base vacía y en una base ya marcada.
- [ ] **Step 3:** FAIL → implementar `migrate.ts` y `markBaseline.ts`, y los scripts `db:migrate` y `db:baseline` → PASS.
- [ ] **Step 4: Checkpoint:** `chore(api): adopt versioned drizzle migrations with a baseline`.

---

### Task 1: Arnés de pruebas de integración

**Files:**
- Create: `apps/api/vitest.int.config.ts`, `apps/api/src/test/setup.int.ts`, `apps/api/src/test/globalSetup.int.ts`, `apps/api/src/test/db.ts`
- Modify: `apps/api/vitest.config.ts` (excluir `**/*.int.test.ts`), `apps/api/package.json` (script `test:int`)

**Interfaces:**
- Produces (`src/test/db.ts`): `testDb: Database`, `resetDb(): Promise<void>` (trunca todas las tablas con `TRUNCATE … RESTART IDENTITY CASCADE`), `createTestTenant(slug: string, name?: string): Promise<{ id: string; slug: string }>` (inserta en `organization`), `createTestUser(overrides?: { email?: string; role?: string; isPlatformAdmin?: boolean }): Promise<{ id: string; email: string }>`, `addMember(userId: string, tenantId: string, role?: string): Promise<void>`, `seedTwoTenants(): Promise<{ a: TestTenant; b: TestTenant }>` donde `TestTenant = { id: string; slug: string; userId: string }`.

- [ ] **Step 1:** Escribir `src/test/db.smoke.int.test.ts` con un test `creates two isolated tenants with one member each` que llama a `seedTwoTenants()` y verifica 2 organizaciones y 2 membresías. Falla (módulos inexistentes).
- [ ] **Step 2:** Implementar la config. **Protección:** `globalSetup.int.ts` aborta salvo que `TEST_DATABASE_URL` esté definida explícitamente (nunca cae a `DATABASE_URL`) y su host sea `localhost` o `127.0.0.1`; test unitario de esa función de validación con hosts remotos y URL ausente. Luego `globalSetup.int.ts` corre `drizzle-kit push --force` contra `TEST_DATABASE_URL` (spawn con `DATABASE_URL` sobrescrito); `setup.int.ts` mockea `../env` igual que `setup.ts` pero con `DATABASE_URL: process.env.TEST_DATABASE_URL` y los valores nuevos de la Tarea 2. Script `"test:int": "vitest run --config vitest.int.config.ts"`.
- [ ] **Step 3:** Implementar `src/test/db.ts` con las firmas de arriba. (Los helpers que tocan `organization`/`member` se completan cuando exista el esquema de la Tarea 3; hasta entonces este test queda marcado `it.todo` y se activa en la Tarea 3.)
- [ ] **Step 4:** `pnpm --filter api test` (unitarias) sigue verde y no recoge `*.int.test.ts`; `pnpm --filter api check-types` limpio.
- [ ] **Step 5: Checkpoint** (pedir OK de commit): `test(api): add integration test harness`.

---

### Task 2: Helpers puros de tenant y variables de entorno

**Files:**
- Create: `apps/api/src/lib/tenant/slug.ts`, `host.ts`, `tenantEq.ts`, `tenantUrl.ts` y un `*.test.ts` junto a cada uno
- Modify: `apps/api/src/env.ts`, `apps/api/src/test/setup.ts` y `setup.int.ts` (valores falsos nuevos)

**Interfaces (Produces):**
- `env`: `APP_BASE_DOMAIN: string` (puede incluir puerto), `APP_PROTOCOL: 'http' | 'https'` (default `https`), `INTERNAL_PROXY_KEY: string` (mín. 16 caracteres). `WEB_ORIGIN` y `WEB_APP_URL` se eliminan de `env` (los reemplaza la resolución por tenant; ver Tarea 7 y 15).
- `slug.ts`: `RESERVED_SLUGS: readonly string[]`; `isValidSlug(slug: string): boolean` (`^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$`, no reservado).
- `host.ts`: `parseTenantSlug(host: string | undefined, baseDomain: string): string | null` — normaliza (minúsculas, sin puerto, sin punto final) y devuelve el único label antes de la base; `null` para host sin subdominio, con más de un nivel, o ajeno (`slug.base.evil.com`, `evil-base`).
- `tenantEq.ts`: `tenantEq(table: { tenantId: PgColumn }, tenantId: string): SQL`.
- `tenantUrl.ts`: `tenantUrl(slug: string, path = '/'): string` = `${APP_PROTOCOL}://${slug}.${APP_BASE_DOMAIN}${path}`.

- [ ] **Step 1:** Tests de `parseTenantSlug` con `base = 'oravitech.test'`: `'Cliente.Oravitech.test:443'`→`'cliente'`; `'cliente.oravitech.test.'`→`'cliente'`; `'oravitech.test'`→`null`; `'a.b.oravitech.test'`→`null`; `'cliente.oravitech.test.evil.com'`→`null`; `'evil-oravitech.test'`→`null`; `undefined`→`null`; con `base = 'localhost:3000'`: `'cliente.localhost:3000'`→`'cliente'`. Tests de `isValidSlug`: rechaza `admin`, `Cliente`, `a`, `-x-`, `x_y`; acepta `acme-2`. Test de `tenantEq` comparando el SQL generado (`toSQL`) contra una tabla de prueba. Test de `tenantUrl` en http y https.
- [ ] **Step 2:** Correr: FAIL (módulos no existen).
- [ ] **Step 3:** Implementar los cuatro módulos y el `env`; el `.pipe` de `APP_BASE_DOMAIN` rechaza esquema y rutas.
- [ ] **Step 4:** `pnpm --filter api test` PASS; `check-types` fallará en los usos de `env.WEB_ORIGIN`/`env.WEB_APP_URL` (`auth.ts`, `server.ts`, `users.service.ts`): dejarlos marcados con `// TODO(task-7/15)` temporales *solo hasta* esas tareas — no se commitea con el `check-types` roto, por lo que este checkpoint se hace junto con la Tarea 7 si hace falta.
- [ ] **Step 5: Checkpoint:** `feat(api): add tenant slug/host helpers and env`.

---

### Task 3: Esquema de Better Auth (organization + admin de plataforma)

**Files:**
- Modify: `apps/api/src/lib/auth.ts` (plugin `organization`, `user.additionalFields.isPlatformAdmin`), `apps/api/src/db/schema/auth.ts` (regenerado con `pnpm --filter api auth:generate`)
- Create: `apps/api/src/db/schema/auth.int.test.ts`

**Interfaces (Produces):** tablas `organization` (`id`, `name`, `slug` único, `logo`, `createdAt`, `metadata`, `customDomain` nullable), `member` (`id`, `organizationId`, `userId`, `role`, `createdAt`), `invitation`; `session.activeOrganizationId`; `user.isPlatformAdmin boolean default false`.

- [ ] **Step 1:** Activar el test `creates two isolated tenants…` de la Tarea 1 y agregar `slug is unique across organizations`.
- [ ] **Step 2:** Correr `pnpm --filter api test:int`: FAIL.
- [ ] **Step 3:** Configurar `organization({ teams: { enabled: false }, schema: { organization: { additionalFields: { customDomain: { type: 'string', required: false } } } } })` y `isPlatformAdmin` como `additionalFields` (`input: false`, `defaultValue: false`); regenerar `schema/auth.ts` y revisar el diff a mano (no debe perder `mustChangePassword` ni campos del plugin `admin`).
- [ ] **Step 4:** `test:int` PASS; `check-types` limpio.
- [ ] **Step 5: Checkpoint:** `feat(api): add organization plugin schema and platform admin flag`.

---

### Task 4: `tenant_id` en tablas de negocio y guardia de esquema

**Files:**
- Create: `apps/api/src/db/schema/tenantColumn.ts`, `apps/api/src/db/schema/tenantTables.test.ts`
- Modify: `apps/api/src/db/schema/{clients,staff,catalog,eventTypes,rescheduleReasons,config,quotes,events,templates,notifications,userPreferences}.ts`

**Interfaces (Produces):** `tenantId(): PgTextBuilder` en `tenantColumn.ts` → `text('tenant_id').notNull().references(() => organization.id)` (el índice se declara en cada tabla). `TENANT_EXEMPT_TABLES: readonly string[]` = `user, session, account, verification, organization, member, invitation`.

- [ ] **Step 1:** Test `tenantTables.test.ts` (sin BD): recorre `Object.values(schema)` con `getTableConfig`, y para cada tabla no exenta exige una columna `tenant_id` `notNull` con FK a `organization.id` y al menos un índice que la incluya; además exige los cambios de unicidad/claves del spec: `event_types`, `products`/catálogo (`name`), `reschedule_reasons` únicos por `(tenant_id, name)`; `quotes` únicos `(tenant_id, seq)` y `(tenant_id, number)`; `app_settings` PK `tenant_id`; `state_settings` PK `(tenant_id, state)`; `user_preferences` única por `(tenant_id, user_id)`. FAIL.
- [ ] **Step 2:** Agregar `tenantId()` + índices a todas las tablas (también las hijas: `product_price_tiers`, `option_groups`, `options`, `event_staff`, `event_payments`, `event_history`, `event_reschedules`, `event_payment_attachments`, `quote_lines`, `quote_line_options`, `quote_stage_history`, `quote_assignment_history`, `notification_reads`). Reemplazar los `.unique()` por `unique().on(tenantId, …)`; cambiar claves de `app_settings` y `state_settings`.
- [ ] **Step 3:** El test pasa. `quote_stages` es catálogo fijo compartido: decidir en este paso si lleva `tenant_id` (el spec no lo lista); **default: sin `tenant_id`**, global y de solo lectura, documentado con un comentario y agregado a `TENANT_EXEMPT_TABLES`.
- [ ] **Step 4:** No se genera migración todavía: se genera una sola `0001` en la Tarea 18 con todo el esquema TS de la fase. `check-types` fallará en los repositorios/seeds que insertan sin `tenantId` o usan `appSettings.id`; es esperado y se resuelve en las Tareas 9–16 (no commitear con el árbol roto: este checkpoint se une al de la Tarea 9).

---

### Task 5: Resolución de tenant y contexto tRPC

**Files:**
- Create: `apps/api/src/lib/tenant/tenantResolver.ts`, `forwardedHost.ts` y tests (`*.int.test.ts` para el resolver, unitario para `forwardedHost`)
- Modify: `apps/api/src/core/trpc/context.ts`

**Interfaces (Produces):**
- `type Tenant = { id: string; slug: string; name: string }`
- `resolveTenantBySlug(slug: string): Promise<Tenant | null>` (caché en memoria de 60 s, también cachea el "no existe" por 10 s), `invalidateTenantCache(slug?: string): void`
- `readTenantHost(headers: IncomingHttpHeaders): string | undefined` — devuelve `x-tenant-host` **solo si** `x-internal-key` coincide con `env.INTERNAL_PROXY_KEY` (comparación en tiempo constante); si no, `undefined`.
- `createContext` devuelve `{ req, res, session, tenant: Tenant | null }`; `tenant` sale de `readTenantHost` → `parseTenantSlug` → `resolveTenantBySlug`.

- [ ] **Step 1:** Tests: `readTenantHost` ignora `x-tenant-host` sin clave, con clave errónea y con clave de distinta longitud; lo acepta con clave correcta. Resolver (int): devuelve la organización por slug; `null` para inexistente; tras `invalidateTenantCache` ve un tenant creado después.
- [ ] **Step 2:** Correr: FAIL.
- [ ] **Step 3:** Implementar con `crypto.timingSafeEqual` (comparar longitudes antes) y un `Map` con expiración.
- [ ] **Step 4:** PASS (`test` y `test:int`).
- [ ] **Step 5: Checkpoint:** `feat(api): resolve tenant from forwarded host`.

---

### Task 6: Cadena de procedures y router `tenant`

**Files:**
- Create: `apps/api/src/lib/tenant/membership.ts`, `apps/api/src/core/trpc/tenantCtx.ts`, `apps/api/src/modules/tenant/tenant.router.ts`, tests
- Modify: `apps/api/src/core/trpc/trpc.ts`, `apps/api/src/core/trpc/router.ts`, `apps/api/src/lib/errors` (código `TENANT_NOT_FOUND`)

**Interfaces (Produces):**
- `isMemberOf(userId: string, tenantId: string): Promise<boolean>`
- `type TenantCtx = { tenantId: string; user: SessionUser; session: Session }` (`tenantCtx.ts`)
- `tenantProcedure` (exige `ctx.tenant`, si no `NOT_FOUND` con `AppError(ErrorCodes.tenant.NOT_FOUND)`), `protectedProcedure` ahora exige además: sesión, `session.activeOrganizationId === ctx.tenant.id`, y (`isMemberOf` **o** `user.isPlatformAdmin`); expone `ctx.tenantId`. `guardedProcedure` sin cambios de firma; el rol efectivo de un admin de plataforma sin membresía es `superadmin`.
- `tenant.current` (query, `tenantProcedure`): `{ id, slug, name }` — lo usa la web para decidir 404.

- [ ] **Step 1:** Tests de integración con `createCaller`: sin tenant → `NOT_FOUND`; sesión de A contra host de B → `FORBIDDEN`; `activeOrganizationId` distinto del tenant → `UNAUTHORIZED`; miembro → pasa y `ctx.tenantId` = tenant; admin de plataforma sin membresía → pasa **y queda una fila en `platform_access_log`** (`userId`, `tenantId`, `path`, `type`, `createdAt`; solo mutaciones y el primer acceso de cada sesión, para no inundar la tabla); un miembro normal no genera filas; `mustChangePassword` sigue bloqueando como hoy. `tenant.current` expone `isPlatformAccess: boolean` para el aviso de "modo plataforma" de la web.
- [ ] **Step 2:** FAIL → implementar la cadena sobre el `protectedProcedure` existente (conservar su chequeo de `mustChangePassword`); crear la tabla `platform_access_log` (esquema Drizzle, agregada a `TENANT_EXEMPT_TABLES` de la Tarea 4) → PASS.
- [ ] **Step 3: Checkpoint:** `feat(api): tenant-aware procedure chain`.

---

### Task 7: Login por tenant, orígenes dinámicos y CORS

**Files:**
- Modify: `apps/api/src/lib/auth.ts`, `apps/api/src/server.ts`
- Create: `apps/api/src/lib/tenant/allowedOrigin.ts`, tests

**Interfaces (Produces):** `isAllowedOrigin(origin: string | undefined): Promise<boolean>` — `true` solo si el host del origen cumple `parseTenantSlug(host, APP_BASE_DOMAIN)` **y** el slug existe (`resolveTenantBySlug`), con el protocolo de `APP_PROTOCOL`.

- [ ] **Step 1:** Tests de `isAllowedOrigin`: acepta `https://acme.<base>` existente; rechaza slug inexistente, `https://acme.<base>.evil.com`, `https://evil-<base>`, `http://` cuando `APP_PROTOCOL=https`, `undefined`. Test de integración del hook de sesión: usuario no miembro → error con el mismo mensaje/código que credenciales inválidas; miembro → sesión con `activeOrganizationId` = tenant; admin de plataforma → entra a cualquier tenant.
- [ ] **Step 2:** FAIL → implementar: `trustedOrigins: async (request) => …` usando `isAllowedOrigin`; `databaseHooks.session.create.before(session, ctx)` lee el tenant desde los headers de `ctx` con `readTenantHost` y devuelve `{ data: { ...session, activeOrganizationId } }` o lanza `APIError` genérico. **Verificar contra los tipos de better-auth 1.6.23** la firma exacta de `databaseHooks` y de `trustedOrigins` dinámico; si no admite función, usar el patrón `https://*.${APP_BASE_DOMAIN}` y dejar el filtro por slug en el CORS. `server.ts`: `cors({ origin: (origin, cb) => … isAllowedOrigin …, credentials: true })`. Asegurar `advanced.crossSubDomainCookies.enabled = false` explícito.
- [ ] **Step 3:** PASS; `check-types` limpio de errores de `env.WEB_ORIGIN`.
- [ ] **Step 4: Checkpoint:** `feat(api): per-tenant login and dynamic origins` (incluye lo pendiente de la Tarea 2).

---

### Task 8: Guardia de Express con tenant

**Files:**
- Create: `apps/api/src/core/express/middleware/guardTenantSession.ts` y test
- Modify: `apps/api/src/core/express/middleware/guardSession.ts` (eliminado y reemplazado)

**Interfaces (Produces):** `guardTenantSession(permissions: PermissionCheck): RequestHandler` — resuelve tenant con `readTenantHost` (404 `{ errorCode: 'TENANT_NOT_FOUND' }`), exige sesión (401), `activeOrganizationId` y membresía/admin de plataforma (403), permisos (403), y deja `res.locals.tenantId` y `res.locals.userId`.

- [ ] **Step 1:** Tests (int, con `supertest` o llamando al handler con req/res falsos si no está instalado `supertest`; preferir el handler directo para no sumar dependencias): sin header interno → 404; sesión de otro tenant → 403; sin permiso → 403; ok → llama `next` con `res.locals` poblado.
- [ ] **Step 2:** FAIL → implementar reutilizando `isMemberOf`/`readTenantHost` → PASS.
- [ ] **Step 3: Checkpoint:** `feat(api): tenant-aware express session guard`. (Se conecta a la ruta de adjuntos en la Tarea 13.)

---

### Task 9: Receta de módulo + `clients` (referencia)

**Files:**
- Create: `apps/api/src/modules/clients/clients.module.ts`, `apps/api/src/modules/clients/clients.isolation.int.test.ts`
- Modify: `clients.repository.ts`, `clients.router.ts` (+ `clients.service.ts` solo si cambia algo de su firma)

**Receta de módulo (aplica a las Tareas 9–15):**
1. El repositorio recibe `constructor(private db: Database, private tenantId: string)`; **toda** consulta (incluidas subconsultas correlacionadas, `exists`, joins y conteos) usa `tenantEq(<tabla>, this.tenantId)` en cada tabla con `tenant_id`; los `update`/`delete` por id también; los `insert` fijan `tenantId` explícito.
2. `<module>.module.ts` exporta `<module>Module(ctx: TenantCtx)` que compone repos y servicio; el router reemplaza el `const service = …` global por `({ ctx, input }) => <module>Module(ctx).<método>(input)`.
3. Todo id recibido en `input` que apunte a otra entidad se resuelve con una lectura del repositorio antes de insertarlo; si no existe en el tenant → el mismo error "no encontrado" del módulo.
4. Test de aislamiento `<module>.isolation.int.test.ts`: con `seedTwoTenants()`, cargar filas en A y B, y para **cada método público del repositorio** comprobar que el repositorio de A no lee, lista, cuenta, actualiza ni borra filas de B, y que listados y conteos de A solo reflejan A; además, por cada relación con otra tabla del módulo, un test que intenta insertar con un id de B desde A y espera rechazo.
5. Actualizar los tests unitarios existentes del módulo si construyen el repositorio.

- [ ] **Step 1:** Escribir `clients.isolation.int.test.ts` según la receta (incluye el campo derivado `status` que usa una subconsulta sobre `quotes`: el cliente de A con una cotización confirmada **de B** sigue siendo `lead`). FAIL.
- [ ] **Step 2:** Aplicar la receta a `clients`. PASS.
- [ ] **Step 3:** `pnpm --filter api check-types` debe estar limpio salvo los módulos aún sin migrar (esos archivos siguen fallando por `tenantId`; se acepta mientras dure la serie 9–16).
- [ ] **Step 4: Checkpoint:** `refactor(api): tenant-scoped clients module` (incluye el esquema de la Tarea 4).

---

### Task 10: `config`, `eventTypes`, `rescheduleReasons`

**Files:** módulos `config`, `eventTypes`, `rescheduleReasons` (repository, router, nuevo `*.module.ts`, tests de aislamiento, `rescheduleReasons.service.test.ts`).

- [ ] **Step 1:** Tests de aislamiento por la receta. Específicos: `ConfigRepository.findAppSettings()` y `findStateSettings()` leen solo la fila del tenant (`appSettings.tenantId`); duplicar el nombre `Boda` en A y B **no** viola la unicidad; dentro del mismo tenant sí.
- [ ] **Step 2:** FAIL → aplicar la receta → PASS.
- [ ] **Step 3: Checkpoint:** `refactor(api): tenant-scoped config, event types, reschedule reasons`.

---

### Task 11: `products`, `templates`, `staff`

**Files:** módulos `products` (catálogo, tiers, grupos, opciones), `templates`, `staff` (incluye `staff.availability.ts`).

- [ ] **Step 1:** Aislamiento por la receta; específico: `findTree()` de A no incluye tiers/grupos/opciones de B; `staff` disponibilidad solo considera `event_staff` del tenant; `templates.findByType` devuelve la plantilla del tenant.
- [ ] **Step 2:** FAIL → receta → PASS.
- [ ] **Step 3: Checkpoint:** `refactor(api): tenant-scoped catalog, templates, staff`.

---

### Task 12: `quotes` y numeración por tenant

**Files:** `quotes.repository.ts`, `quotes.router.ts`, `quotes.service.ts`, `quotes.pdf.ts` (si arma consultas), nuevo `quotes.module.ts`, `quotes.isolation.int.test.ts`, `quotes.numbering.int.test.ts`.

**Interfaces (Produces):** `QuotesRepository.nextSeq(tx: Database): Promise<number>` — toma `pg_advisory_xact_lock(hashtext(tenantId))` y devuelve `max(seq)+1` del tenant (respetando `quoteSeqStart` de `app_settings`), dentro de la transacción de creación existente.

- [ ] **Step 1:** Tests: aislamiento por la receta (board, listados, historiales, disponibilidad `findByDateTime`, líneas y opciones); `numbering`: A y B arrancan ambos en seq 1 y `number` repetido entre tenants no choca; **50 creaciones concurrentes en un tenant** (`Promise.all`) producen seqs únicos y consecutivos sin error de unicidad.
- [ ] **Step 2:** FAIL → receta + `nextSeq` (reemplaza el `max(seq)` de `quotes.service.ts` ~L198) → PASS.
- [ ] **Step 3: Checkpoint:** `refactor(api): tenant-scoped quotes with per-tenant numbering`.

---

### Task 13: `events`, `payments`, `notifications` y ruta de adjuntos

**Files:** módulos `events` (repository, router, service, controller, `events.express.ts`), `payments`, `notifications`; tests de aislamiento y `events.permissions.test.ts`, `events.service.reschedule.test.ts`.

- [ ] **Step 1:** Aislamiento por la receta, más: (a) subir un adjunto con el `paymentId` de un pago de B estando en A → 404 `eventPayment.NOT_FOUND` y no inserta; (b) `notifications` de A no aparecen para el mismo usuario global cuando consulta desde B, y `notificationReads` se cuentan por tenant; (c) la ruta de adjuntos sin header interno / con sesión de otro tenant → rechazada (usando `guardTenantSession`).
- [ ] **Step 2:** FAIL → receta; `events.controller.ts` deja de crear el servicio global: construye `eventsModule` desde `res.locals.tenantId` (`eventsModuleFromTenant(tenantId: string, userId: string)`); `events.express.ts` usa `guardTenantSession`. La clave de R2 de los adjuntos nuevos pasa a `t/${tenantId}/event-payments/${uuid}.${ext}`.
- [ ] **Step 3:** PASS.
- [ ] **Step 4: Checkpoint:** `refactor(api): tenant-scoped events, payments, notifications and uploads`.

---

### Task 14: `dashboard`

**Files:** `dashboard.repository.ts`, `dashboard.router.ts`, nuevo `dashboard.module.ts`, `dashboard.isolation.int.test.ts`.

- [ ] **Step 1:** Con datos distintos en A y B, cada agregado (resumen, gráfico de cotizaciones, top productos) devuelve solo lo del tenant (valores esperados distintos y conocidos). FAIL.
- [ ] **Step 2:** Receta (cada agregación filtra todas las tablas que une) → PASS.
- [ ] **Step 3: Checkpoint:** `refactor(api): tenant-scoped dashboard`.

---

### Task 15: `users` y `userPreferences` (usuario global con membresías)

**Files:** `users.repository.ts`, `users.service.ts`, `users.router.ts`, `users.resource.ts`, `userPreferences.*`, nuevos `*.module.ts` y tests.

**Interfaces:** `UsersRepository` recibe `(db, tenantId)`; el listado y `findById` consultan `user` **unido a `member`** del tenant (el rol visible es `member.role`); `create`/`update` escriben `member.role` **y** `user.role` (la autorización de la fase 1 sigue leyendo `user.role`); `issuePasswordSetupLink` usa `tenantUrl(slug, '/set-password?…')`.

- [ ] **Step 1:** Tests (int): el listado de A no incluye usuarios que solo son miembros de B; **`create` con un email que ya es usuario de B** crea solo la membresía en A, no cambia su contraseña ni `mustChangePassword`, y responde `{ user, setupUrl: null }`; `create` con un email que ya es miembro de A → `ALREADY_EXISTS`; `update`/`delete`/regenerar enlace sobre un usuario de B desde A → `NOT_FOUND`; las preferencias del mismo usuario son independientes por tenant.
- [ ] **Step 2:** FAIL → implementar. `setupUrl` pasa a ser `string | null` en `@repo/schemas`/resource; **ajustar la UI** que lo muestra en `apps/web/src/features/users` (si es `null`, mostrar un aviso "el usuario ya tenía cuenta; se agregó a la organización") con claves i18n es/en, siguiendo `docs/frontend/architecture.md`.
- [ ] **Step 3:** PASS; `pnpm check-types` (monorepo) limpio.
- [ ] **Step 4: Checkpoint:** `refactor: tenant-scoped users with memberships`.

---

### Task 16: `createTenant`, semillas por tenant y script

**Files:**
- Create: `apps/api/src/lib/tenant/createTenant.ts`, `createTenant.int.test.ts`, `apps/api/src/db/scripts/createTenant.ts`
- Modify: `apps/api/src/db/seeds/*.ts` (cada `seedX` recibe `tenantId`), `apps/api/src/db/seeds/index.ts`, `apps/api/package.json` (`tenant:create`)

**Interfaces (Produces):** `createTenant(input: { slug: string; name: string; adminEmail: string; adminName: string }): Promise<{ tenantId: string; setupUrl: string }>` — valida `isValidSlug`, crea la organización, siembra por tenant (`app_settings`, `state_settings`, tipos de evento, motivos de reprogramación, catálogo base, plantilla de PDF, `quote_stages` si no es global), crea el admin con membresía y devuelve el enlace de contraseña. `seedTenantDefaults(tenantId: string): Promise<void>` agrupa las semillas "base" que hoy corren siempre.

- [ ] **Step 1:** Tests (int): slug reservado/ inválido/ duplicado → error; tenant recién creado tiene `app_settings` y `state_settings`, `config.get` responde y se puede **crear una cotización** (numeración 1); el admin es miembro con rol `admin`; dos `createTenant` consecutivos no comparten filas.
- [ ] **Step 2:** FAIL → implementar (dentro de una transacción; el slug se normaliza a minúsculas antes de validar) → PASS.
- [ ] **Step 3:** Datos demo multi-tenant. `db:seed --demo=local` crea **dos tenants demo** (`demo-norte` y `demo-sur`, nombres y datos distintos) y puebla cada uno con una demo completa: usuarios de cada rol (`superadmin`/`admin`/`operator`/`member`), clientes, staff, catálogo con tiers/grupos/opciones, tipos de evento, cotizaciones repartidas en todas las etapas (con líneas y opciones), eventos con pagos y adjuntos, reprogramaciones y notificaciones. Además un admin de plataforma (`isPlatformAdmin`, sin membresía propia) y **un usuario que es miembro de ambos tenants** (mismo email, rol distinto en cada uno) para ejercitar el usuario global. Los datos de un tenant son reconociblemente distintos de los del otro (nombres, montos, fechas) para detectar fugas a simple vista. `--demo=prod` solo siembra los defaults del tenant indicado con `--tenant=<slug>`. Test de integración: tras `db:seed --demo=local`, cada tabla de negocio tiene filas de ambos tenants y ninguna fila queda sin `tenant_id`. Documentar flags y usuarios demo (emails y roles, sin contraseñas reales) en el `--help` del script y en `docs/backend/architecture.md`.
- [ ] **Step 4: Checkpoint:** `feat(api): createTenant and per-tenant seeds`.

---

### Task 17: Jobs y crons

**Files:** `apps/api/src/crons/index.ts`, `apps/api/src/jobs/eventReminders.job.ts`, `apps/api/src/jobs/scripts/runEventReminders.ts`, `apps/api/src/server.ts`.

- [ ] **Step 1:** `checkEventSelectionsReminders(tenantId: string)` construye sus repositorios con el tenant; el script acepta `--tenant=<slug>`.
- [ ] **Step 2:** `registerCrons()` deja de llamarse desde `server.ts` con un comentario que explique el *porqué* (los cron jobs no iteran por tenant todavía); `check-types` limpio.
- [ ] **Step 3: Checkpoint:** `chore(api): scope reminder job to a tenant and disable crons`.

---

### Task 18: Migración `0001` del tenant #1 y verificador

**Files:**
- Create: `apps/api/drizzle/0001_multitenant_core.sql` (generada y editada), `apps/api/src/db/scripts/verifyMultitenant.ts`, `apps/api/src/db/multitenant.migration.int.test.ts`
- Modify: `apps/api/package.json` (`mt:verify`; `db:fresh` pasa a `db:reset && db:migrate && db:seed`)

**Interfaces (Produces):** `verifyMultitenant.ts` imprime conteos por tabla y falla (exit 1) si hay filas sin `tenant_id`, usuarios sin `member`, filas huérfanas o duplicados según las nuevas unicidades; se corre antes y después de `db:migrate`. La migración lee `current_setting('mt.tenant_slug', true)` y `current_setting('mt.tenant_name', true)`, que `db:migrate --set mt.tenant_slug=<slug> --set mt.tenant_name="<nombre>"` fija.

- [ ] **Step 1:** Con el esquema TS final de la fase (Tareas 3, 4 y `platform_access_log`), correr `pnpm --filter api db:generate --name=multitenant_core` y **reescribir el SQL generado** en tres etapas dentro del mismo archivo (separadas por `--> statement-breakpoint`): (a) aditivo — tablas del plugin, `session.activeOrganizationId`, `user.is_platform_admin`, `platform_access_log`, `tenant_id` **nullable** en todas las tablas; (b) backfill — *solo si `"user"` tiene filas*: exige `mt.tenant_slug` y `mt.tenant_name` (falla con mensaje claro si faltan), crea la organización, un `member` por usuario con su rol, `is_platform_admin` para los `superadmin`, `tenant_id` en todas las filas, la fila de `app_settings` del tenant a partir de la fila `id = 1`, y `active_organization_id` en las sesiones; en una base vacía no crea nada; (c) endurecimiento — `NOT NULL`, FK, índices, unicidades compuestas y cambio de claves primarias de `app_settings` y `state_settings`.
- [ ] **Step 2:** Test `multitenant.migration.int.test.ts`: crear una base y aplicar **solo `0000`** (carpeta temporal con el `_journal.json` truncado), cargar datos de ejemplo (usuarios con roles, cotizaciones con `seq`, `app_settings` id=1, sesiones abiertas, adjuntos) → `verify` previo → `migrate` con los dos `--set` → `verify` posterior ok; todas las filas con el `tenant_id` del tenant #1; `app_settings` con los valores originales; un `member` por usuario con el mismo rol; `isPlatformAdmin` solo para `superadmin`; sesiones con `activeOrganizationId`; sin los `--set` y con datos → falla y la base queda exactamente como estaba; sobre base vacía → aplica sin los `--set` y no crea organizaciones; ejecutarla de nuevo no cambia nada.
- [ ] **Step 3:** FAIL → completar el SQL editado → PASS.
- [ ] **Step 4:** Equivalencia con el esquema TS: tras aplicar `0000` + `0001` sobre una base vacía, `pnpm --filter api db:generate` debe responder que no hay cambios, y `drizzle-kit check` sin errores. Documentar ambos comandos en el runbook (Tarea 20).
- [ ] **Step 5: Checkpoint:** `feat(api): tenant #1 migration 0001 and verifier`.

---

### Task 19: Web — proxy con host, página de tenant inexistente

**Files:**
- Create: `apps/web/src/lib/tenant/proxyHeaders.ts` y test, `apps/web/src/app/tenant-not-found/page.tsx`, claves i18n en `apps/web/src/locales/{es,en}`
- Modify: `apps/web/src/middleware.ts`, `apps/web/next.config.ts` (retirar los `rewrites` a la API), `apps/web/src/env.ts`

**Interfaces (Produces):** `buildProxyHeaders(requestHeaders: Headers, internalKey: string): Headers` — copia los headers y fija `x-tenant-host` (host original, normalizado) y `x-internal-key`, descartando cualquier `x-tenant-host`/`x-internal-key` que ya trajera el cliente.

- [ ] **Step 1:** Leer `docs/frontend/architecture.md` y `styling-guide.md`. Test de `buildProxyHeaders`: sobrescribe valores falsificados por el navegador; conserva `cookie`.
- [ ] **Step 2:** FAIL → implementar; el `middleware` agrega una rama previa a la lógica de auth: para `/trpc`, `/api/auth` y `/api/uploads` hace `NextResponse.rewrite(new URL(path + search, API_URL), { request: { headers: buildProxyHeaders(…) } })`, y el `matcher` deja de excluir esos prefijos. (`API_URL` e `INTERNAL_PROXY_KEY` son variables del servidor, nunca públicas.) La página `tenant-not-found` (server component, mobile-first, AntD/Tailwind, i18n) se muestra cuando `tenant.current` responde `TENANT_NOT_FOUND`; el layout raíz consulta `tenant.current` por servidor una vez por request y, si `isPlatformAccess` es `true`, muestra un aviso persistente de "modo plataforma" (clave i18n es/en).
- [ ] **Step 3:** `pnpm --filter web test` y `check-types` limpios. **Verificación manual del usuario en `staging-mt`:** que `x-tenant-host` llega a la API (la ruta `tenant.current` devuelve el tenant correcto).
- [ ] **Step 4: Checkpoint:** `feat(web): forward tenant host to the API and add tenant-not-found page`.

---

### Task 20: Documentación y runbooks

**Files:**
- Modify: `docs/backend/architecture.md` (patrón multi-tenant: `tenantProcedure`, `xModule(ctx)`, receta de repositorio, `tenantEq`, regla de FK), `CLAUDE.md` (referencia a la receta), `.env.example` si existe (variables nuevas)
- Create: `docs/superpowers/runbooks/multitenant-cutover.md`, `docs/superpowers/runbooks/multitenant-regression-checklist.md`

- [ ] **Step 1:** Runbook de cutover (backup, ventana, `db:baseline` una sola vez en cada base creada con `push`, `mt:verify`, `db:migrate --set mt.tenant_slug=… --set mt.tenant_name=…`, `mt:verify`, smoke tests, criterios y ventana de reversión, ensayo mínimo x2 con snapshot, variables de entorno nuevas por servicio, `staging-mt` con bucket R2/correo aislados). Actualizar en `docs/backend/architecture.md` (~L393) y en `CLAUDE.md` el flujo de esquema: de "`db:push` sin migraciones" a "cambiar el esquema TS → `db:generate` → revisar y commitear el SQL → `db:migrate`"; y en el runbook, cómo portar a una migración cualquier cambio de esquema que llegue a `main` con `push` mientras `multitenant` está abierta. Checklist de regresión manual por flujo (clientes, cotizaciones, PDF, eventos, pagos y adjuntos, staff, catálogo, configuración, usuarios, notificaciones, dashboard) basado en `docs/mach-bar-flows.md`, más casos de aislamiento con dos tenants y de login cruzado.
- [ ] **Step 2: Checkpoint:** `docs: multi-tenant architecture notes, cutover runbook and regression checklist`.

---

### Task 21: Verificación final de la fase

**Files:** ninguno nuevo.

- [ ] **Step 1:** `pnpm check-types`, `pnpm test` y `pnpm --filter api test:int` en verde (la última la corre el usuario si no hay Postgres de prueba disponible; reportar la salida real); `pnpm --filter api db:generate` sin cambios pendientes.
- [ ] **Step 2:** Revisión contra el spec, sección por sección (modelo, resolución/auth, rutas de Express, aislamiento, entornos, pruebas): listar cualquier requisito sin cubrir. Confirmar que no queda `// TODO(task-…)` ni referencias a `env.WEB_ORIGIN`/`env.WEB_APP_URL`/`appSettings.id`/`guardSession`.
- [ ] **Step 3:** Entregar al usuario: lista de verificaciones manuales pendientes en `staging-mt` (host reenviado, `trustedOrigins`, cookies por subdominio, checklist de regresión) y los dos ensayos de migración.
- [ ] **Step 4: Checkpoint:** PR hacia `multitenant` solo con OK explícito del usuario.
