# Multi-tenant fase 1b (RLS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Postgres Row Level Security como segunda barrera de aislamiento: la API corre con un rol sin `BYPASSRLS`, cada petición con tenant abre una transacción que fija `app.tenant_id`, y toda tabla con `tenant_id` tiene política.

**Architecture:** Tres roles de Postgres (`owner`, `app`, `platform`). `withTenantTx(tenantId, fn)` es la única primitiva que fija el tenant (`set_config('app.tenant_id', $1, true)` dentro de una transacción). La cadena de tRPC y la guarda de Express abren esa transacción y la exponen como `ctx.db`; los repositorios siguen con `(db, tenantId)` y `tenantEq`. Las operaciones con llamadas externas lentas y el trabajo en segundo plano usan transacciones cortas propias.

**Tech Stack:** Postgres (Docker local, Neon staging, Railway probable en producción), Drizzle ORM + drizzle-kit (`pgPolicy`), `postgres-js`, tRPC v11, Express 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-08-multitenant-fase1b-rls-design.md`

## Global Constraints

- Comentarios de código en inglés y solo el porqué no obvio; nunca referencias a la tarea o al chat.
- No commits, no `git push`, sin worktrees: el usuario pide cada commit.
- No levantar servidores ni abrir el navegador; no leer archivos `.env`; no ejecutar `db:migrate`, `db:roles` ni `db:fresh` contra ninguna base real (los corre el usuario).
- Esquema: cambiar el TS → `db:generate` → revisar el SQL → (el usuario) `db:migrate`; nunca `db:push` fuera de la base de pruebas.
- Pruebas de integración: `pnpm --filter api exec vitest run --config vitest.int.config.ts <patrón>` con `TEST_DATABASE_URL` en línea (base local desechable, la guarda `dbGuard` solo admite localhost); `test:int -- <patrón>` NO filtra. La URL nunca se escribe en archivos, logs ni reportes. Las contraseñas de roles de prueba son constantes del código de prueba (base local desechable).
- `pnpm check-types` y los tests unitarios se pueden correr libremente.
- Textos de documentación en español; claves i18n es/en en paridad si se tocan.
- La FK compuesta `(role_id, tenant_id)` queda fuera de este plan salvo que la revisión final la pida.

## Review Focus

Entradas o condiciones que la spec implica y ninguna tarea prueba de forma obvia; cada una tiene su prueba en la tarea indicada:

1. Petición sin organización fijada (cualquier consulta fuera de `withTenantTx`) → cero filas y `INSERT` rechazado, nunca datos de otra organización (T3).
2. El tenant no se filtra entre peticiones que reutilizan la misma conexión del pool, ni con pooler en modo transacción (T2).
3. Trabajo en segundo plano que sigue vivo tras cerrar la transacción de la petición (`void this.generatePdf(...)` en `quotes.service`) no debe usar una transacción cerrada (T6).
4. Error dentro de un procedure → `ROLLBACK` y el error original llega al cliente intacto (código y `errorCode`) (T4).
5. Admin de plataforma sin membresía solo ve la organización elegida; el job de recordatorios (cruza organizaciones) sigue funcionando con `app` (T4, T7).

---

### Task 1: Roles de Postgres, script `db:roles` y verificación de arranque

**Files:**
- Create: `apps/api/src/db/scripts/roles.ts` (script `db:roles`), `apps/api/src/db/roleGuard.ts`, `apps/api/src/db/scripts/test/roles.int.test.ts`
- Modify: `apps/api/package.json` (script `db:roles`), `apps/api/src/env.ts` (`DB_POOL_MAX`), `apps/api/src/db/index.ts` (pool `max`), `apps/api/src/server.ts` (llamar a la verificación antes de `listen`), `apps/api/src/test/globalSetup.int.ts` (crear los roles de prueba después del `push`)

**Interfaces:**
- Produces: `ensureRoles(sql, { appPassword, platformPassword, ownerRole }): Promise<void>` (idempotente: crea `app` y `platform` con `LOGIN`, `app` con `NOSUPERUSER NOBYPASSRLS`, `platform` con `BYPASSRLS`; concede a `app`/`platform` `USAGE` en el esquema, `SELECT/INSERT/UPDATE/DELETE` en todas las tablas y `USAGE/SELECT` en secuencias; `ALTER DEFAULT PRIVILEGES` para objetos futuros del dueño) en `scripts/roles.ts`.
- Produces: `assertAppRoleRestricted(sql: Sql): Promise<void>` en `roleGuard.ts`; lanza `Error` con mensaje que apunta a `db:roles` si `current_user` es `rolsuper` o `rolbypassrls`.
- Produces: constantes de roles de prueba `TEST_APP_ROLE`, `TEST_PLATFORM_ROLE` y sus contraseñas en `apps/api/src/test/roles.ts`; `globalSetup` los crea con `ensureRoles` tras el `push` (los roles son del clúster: la creación es idempotente).
- `env.DB_POOL_MAX`: `z.coerce.number().int().min(1).default(10)`.

- [ ] **Step 1: Write failing tests** en `roles.int.test.ts`: tras `ensureRoles`, `pg_roles` muestra `app` sin `rolsuper` ni `rolbypassrls` y `platform` con `rolbypassrls`; ejecutarlo dos veces no falla; `assertAppRoleRestricted` lanza con una conexión superusuario y resuelve con una conexión `app`; el mensaje del error contiene `db:roles`.
- [ ] **Step 2:** Run `pnpm --filter api exec vitest run --config vitest.int.config.ts roles` (con `TEST_DATABASE_URL` en línea) — Expected: FAIL (módulos inexistentes).
- [ ] **Step 3:** Implementar `ensureRoles` (SQL con `DO $$ ... IF NOT EXISTS ... $$` y `ALTER ROLE` para reaplicar atributos; contraseñas como parámetros de la conexión, nunca interpoladas en logs), `assertAppRoleRestricted`, el script (se conecta con `DATABASE_OWNER_URL` y toma usuario y contraseña de los roles de `DATABASE_APP_URL` y `DATABASE_PLATFORM_URL`; imprime solo los nombres de rol creados), `DB_POOL_MAX` en el cliente (`postgres(env.DATABASE_APP_URL, { max: env.DB_POOL_MAX })`) y la llamada de arranque en `server.ts`.
- [ ] **Step 4:** Run las pruebas de Step 2 y `pnpm --filter api test` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 2: Primitiva `withTenantTx`

**Files:**
- Create: `apps/api/src/db/tenantTx.ts`, `apps/api/src/db/test/tenantTx.int.test.ts`
- Modify: `apps/api/src/db/index.ts` (exportar `Tx` ya existe; reexportar `withTenantTx`)

**Interfaces:**
- Produces: `withTenantTx<T>(tenantId: string, fn: (tx: Tx) => Promise<T>, database?: Database): Promise<T>` — abre `database.transaction`, ejecuta `select set_config('app.tenant_id', $1, true)` con `tenantId` como parámetro, llama `fn(tx)`. Lanza `Error` si `tenantId` está vacío.
- Produces: tipo `TenantRunner = <T>(fn: (tx: Tx) => Promise<T>) => Promise<T>` (lo usan T4–T6).

- [ ] **Step 1: Write failing tests**: dentro de `fn`, `current_setting('app.tenant_id', true)` devuelve el tenant; tras el commit, una consulta posterior en el mismo pool devuelve nulo o vacío (no se filtra entre peticiones; probar con `max: 1` para forzar la misma conexión); si `fn` lanza, hay `ROLLBACK` (una fila insertada dentro no persiste) y el error original se propaga; `tenantId` vacío lanza; un valor con comillas o `'` se pasa como parámetro y no rompe la consulta.
- [ ] **Step 2:** Run `pnpm --filter api exec vitest run --config vitest.int.config.ts tenantTx` — Expected: FAIL.
- [ ] **Step 3:** Implementar `withTenantTx` y `TenantRunner`.
- [ ] **Step 4:** Run las pruebas y `pnpm check-types` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 3: Políticas RLS y migración `0005`

**Files:**
- Modify: `apps/api/src/db/schema/*.ts` de cada tabla de `TENANT_TABLES` (`verifyMultitenant.ts`) y `platformAccessLog.ts` (política `pgPolicy` + `.enableRLS()`)
- Create: `apps/api/drizzle/0005_*.sql` (generada y luego completada a mano con `ALTER TABLE ... FORCE ROW LEVEL SECURITY` por tabla; se revisa antes de que el usuario la aplique), `apps/api/src/db/schema/rls.ts` (helper `tenantIsolationPolicy(table)` compartido), `apps/api/src/db/schema/test/rls.int.test.ts`, `apps/api/src/db/schema/test/rlsMigration.int.test.ts`

**Interfaces:**
- Produces: `tenantIsolationPolicy(name: string)`: política `FOR ALL TO PUBLIC` con `USING` y `WITH CHECK` `tenant_id = current_setting('app.tenant_id', true)`; usada por todas las tablas.
- Consumes: roles de prueba de T1, `withTenantTx` de T2, `TENANT_TABLES`.

- [ ] **Step 1: Write failing tests** `rls.int.test.ts` (conexión con el rol `app` de prueba, base armada con `push`), recorriendo `TENANT_TABLES` y `platform_access_log`: con el tenant A fijado `select` devuelve solo filas de A; sin tenant fijado devuelve cero filas; `insert` con `tenant_id` de B estando fijado A falla con violación de política; `update` y `delete` sobre filas de B afectan 0 filas; el rol `platform` ve filas de A y B. `rlsMigration.int.test.ts` (siguiendo el patrón de `migration.0001.int.test.ts`: aplica las migraciones reales en una base temporal): cada tabla tiene `relrowsecurity` y `relforcerowsecurity` verdaderos y una política con el nombre esperado.
- [ ] **Step 2:** Run `... vitest run --config vitest.int.config.ts rls` — Expected: FAIL.
- [ ] **Step 3:** Declarar las políticas en el esquema, correr `pnpm --filter api db:generate`, completar el SQL con los `FORCE` y revisarlo (nombre del archivo y `_journal.json` consistentes; sin tocar 0002–0004). No aplicar la migración a ninguna base real.
- [ ] **Step 4:** Run las pruebas y `pnpm check-types` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear; el SQL de `0005` se revisa con el usuario antes de `db:migrate`.

### Task 4: Transacción por petición en la cadena de tRPC

**Files:**
- Modify: `apps/api/src/core/trpc/trpc.ts`, `apps/api/src/core/trpc/tenantCtx.ts`, `apps/api/src/lib/rbac/access.ts` (`resolveRequestAccess` y `resolveAccess` reciben un `Executor`), `apps/api/src/core/trpc/platformAccess.ts` (recibe el `Executor`), tests de `core/trpc/test/*`

**Interfaces:**
- Produces: `TenantCtx` gana `db: Executor` y `runInTenant: TenantRunner` (transacción corta independiente de la de la petición, para T6).
- `protectedProcedure`: abre `withTenantTx(tenantId, ...)` **antes** de `resolveRequestAccess`, ejecuta el resto de la cadena dentro y pasa `ctx.db = tx`. Cuando `next()` devuelve `{ ok: false }` relanza `result.error` para provocar `ROLLBACK` sin alterar el error que ve el cliente.
- `protectedProcedure` acepta `meta({ shortTx: true })`: no abre la transacción larga; `ctx.db` no existe para esos procedures (tipo distinto: `shortTxProcedure`) y el acceso se resuelve con `runInTenant`. Produces: `shortTxProcedure` exportado de `trpc.ts`.
- Procedures sin tenant (`publicProcedure`, `authedProcedure`, `tenantProcedure` sin llegar a `protectedProcedure`) no abren transacción.

- [ ] **Step 1: Write failing tests** en `tenantChain.int.test.ts` con el rol `app` de prueba: un procedure de prueba lee `current_setting('app.tenant_id', true)` y recibe el tenant de la sesión; un procedure que lanza `AppError` produce `ROLLBACK` (la escritura previa no persiste) y el cliente recibe el mismo `errorCode`; un admin de plataforma sin membresía solo ve las filas de la organización elegida (consulta sin `WHERE` desde un procedure de prueba); un `shortTxProcedure` no retiene transacción abierta durante una espera (la conexión vuelve al pool antes de la espera: `pg_stat_activity` sin `idle in transaction`).
- [ ] **Step 2:** Run `... vitest run --config vitest.int.config.ts tenantChain` — Expected: FAIL.
- [ ] **Step 3:** Implementar los cambios de la cadena y ajustar `resolveAccess`/`recordPlatformAccess` para usar el `Executor` recibido.
- [ ] **Step 4:** Run `tenantChain`, `access`, `tenant.router` y `pnpm check-types` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 5: Módulos y guarda de Express sobre `ctx.db`

**Files:**
- Modify: los `*.module.ts` de los 32 módulos que hoy importan `db` (`apps/api/src/modules/*/*.module.ts`), `apps/api/src/modules/events/events.module.ts` (`eventsModuleFromTenant`), `apps/api/src/core/express/middleware/guardTenantSession.ts`, `apps/api/src/modules/events/events.controller.ts`, tests que construyen módulos o contextos a mano (`apps/api/src/test/trpcCaller.ts` y los `*.int.test.ts` que llamen `xModule(ctx)`)

**Interfaces:**
- Consumes: `TenantCtx.db` de T4. Cada `xModule(ctx)` usa `ctx.db` en lugar del `db` global; los repositorios no cambian de firma.
- `guardTenantSession` abre la misma transacción que la cadena de tRPC y deja `res.locals.db`; el controlador de subida de adjuntos se ajusta en T6.
- Tarea mecánica del mismo tipo en todos los módulos: se hace en un solo despacho.

- [ ] **Step 1: Write failing test** `apps/api/src/core/express/middleware/test/guardTenantSession.int.test.ts` ampliado: con el rol `app`, la ruta protegida lee solo filas del tenant de la sesión y una ruta sin tenant fijado recibe cero filas; los tests de módulos con rol `app` pasan sin cambio de lógica.
- [ ] **Step 2:** Run los tests de Express y `pnpm check-types` — Expected: FAIL (tipos y firma).
- [ ] **Step 3:** Cambiar las fábricas de módulos a `ctx.db`, el middleware de Express y los tests que construían contextos.
- [ ] **Step 4:** Run `pnpm check-types`, `pnpm --filter api test` y la suite de integración completa — Expected: PASS (las pruebas existentes siguen con un rol que se salta el RLS).
- [ ] **Checkpoint:** cambios sin commitear.

### Task 6: Operaciones lentas y trabajo en segundo plano

**Files:**
- Modify: `apps/api/src/modules/quotes/quotes.service.ts` (`generatePdf` y los `void this.generatePdf(...)` de crear/actualizar), `apps/api/src/modules/quotes/quotes.router.ts` (`generatePdf` y `regeneratePdf` usan `shortTxProcedure`), `apps/api/src/modules/events/events.service.ts` (`addPaymentAttachment`), `apps/api/src/modules/events/events.controller.ts` y `events.express.ts` (la ruta de adjuntos no retiene transacción larga), tests asociados

**Interfaces:**
- Consumes: `TenantRunner`/`runInTenant` (T2/T4), `shortTxProcedure`.
- Los procedures `shortTxProcedure` no tienen `ctx.db`: el módulo de quotes/events se construye para ellos con repositorios creados dentro de cada fase por `runInTenant((tx) => new XRepository(tx, tenantId))`, sin abrir otra vía de acceso a la base.
- `generatePdf` pasa a tres fases: lectura en una transacción corta, llamada al servicio de PDF fuera de toda transacción, escritura de `setPdfInfo` en otra transacción corta.
- Los `void this.generatePdf(...)` de segundo plano abren su propia `withTenantTx(tenantId, ...)` (la transacción de la petición ya habrá terminado) y registran el error sin afectar la respuesta.
- `addPaymentAttachment`: valida y resuelve el pago (transacción corta), sube a almacenamiento fuera de transacción, guarda la fila (transacción corta); si el guardado falla, borra el archivo ya subido.

- [ ] **Step 1: Write failing tests**: `generatePdf` con el rol `app` no mantiene transacción abierta durante la llamada al servicio de PDF (servicio simulado que espera y comprueba `pg_stat_activity`); el segundo plano tras `create` ejecuta `setPdfInfo` sin error aunque la petición ya terminó; `addPaymentAttachment` con guardado fallido llama a `storage.delete` con la clave subida; aislamiento: un pago de otro tenant devuelve not found.
- [ ] **Step 2:** Run los tests de quotes/events — Expected: FAIL.
- [ ] **Step 3:** Implementar las tres fases, el segundo plano propio y el borrado compensatorio.
- [ ] **Step 4:** Run `pnpm --filter api test`, la suite de integración completa y `pnpm check-types` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 7: Código que cruza organizaciones, scripts y `mt:verify`

**Files:**
- Create: `apps/api/src/db/platform.ts` (`platformDb`, cliente con `DATABASE_PLATFORM_URL`)
- Modify: `apps/api/src/db/seeds/*`, `apps/api/src/db/scripts/{createTenant,reset,markBaseline,verifyMultitenant,migrate}.ts` (usan `DATABASE_PLATFORM_URL` o `DATABASE_OWNER_URL` según corresponda; sin respaldo silencioso a `DATABASE_APP_URL` ni a `DATABASE_URL`), `apps/api/src/lib/tenancy/createTenant.ts` (recibe el cliente), `apps/api/src/jobs/eventReminders.job.ts` y `apps/api/src/jobs/scripts/*` (cada organización dentro de `withTenantTx`), `apps/api/package.json` si cambian scripts, tests asociados

**Interfaces:**
- Consumes: `withTenantTx`, `TENANT_TABLES`.
- `mt:verify` añade comprobaciones: cada tabla con `tenant_id` tiene RLS habilitado, forzado y su política; el rol de la conexión de la API no es superusuario ni `BYPASSRLS` (cuando se ejecuta con la URL de `app`); el rol `platform` tiene `BYPASSRLS`.
- Los scripts fallan con un mensaje claro si falta la variable de su rol.

- [ ] **Step 1: Write failing tests**: `verifyMultitenant.rls.int.test.ts` detecta una tabla sin política (se quita en la prueba) y una conexión `app` con `BYPASSRLS`; el job de recordatorios con el rol `app` crea las notificaciones de dos organizaciones usando un `withTenantTx` por organización; `createTenant` sigue creando el tenant con el cliente `platform`.
- [ ] **Step 2:** Run `... vitest run --config vitest.int.config.ts verifyMultitenant eventReminders createTenant` — Expected: FAIL.
- [ ] **Step 3:** Implementar `platformDb`, cambiar scripts, seeds y job, y ampliar `mt:verify`.
- [ ] **Step 4:** Run la suite de integración completa, `pnpm --filter api test` y `pnpm check-types` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 8: Documentación, runbook y configuración

**Files:**
- Modify: `docs/backend/architecture.md` (nueva sección de RLS y reglas: un repositorio nunca abre conexiones propias; qué usa `withTenantTx`; operaciones lentas), `docs/superpowers/runbooks/multitenant-cutover.md` (pasos: `db:roles`, `0005`, `DATABASE_APP_URL` con el rol `app`, variables nuevas, orden de despliegue, dimensionado de `DB_POOL_MAX` y prueba de carga en `staging-mt`, pgBouncer como plan B con `postgres-js` sin sentencias preparadas), archivo de ejemplo de variables si existe (`.env.example`; no leer `.env`)
- Test: suites completas

- [ ] **Step 1:** Run `pnpm check-types`, `pnpm test` y la suite de integración completa — Expected: PASS antes de documentar.
- [ ] **Step 2:** Documentar roles, variables (`DATABASE_APP_URL`=`app`, `DATABASE_OWNER_URL`, `DATABASE_PLATFORM_URL`, `DB_POOL_MAX`), el orden por entorno (Docker local, Neon, Railway) y la regla de `withTenantTx`.
- [ ] **Step 3:** Run las suites completas otra vez — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear. Checklist manual para el usuario: ejecutar `db:roles` en local con el rol administrador, actualizar su `.env` (`DATABASE_URL` pasa a `DATABASE_APP_URL` con el rol `app`, y las variables nuevas), `db:fresh`, `mt:verify`, crear una cotización con PDF y subir un adjunto de pago, entrar como admin de plataforma a una organización, y probar `staging-mt` en Neon.
