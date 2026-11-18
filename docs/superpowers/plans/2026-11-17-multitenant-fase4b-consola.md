# Consola de plataforma (`/console`) — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al administrador de plataforma una consola web (`/console`) para listar y crear organizaciones, cambiar sus features y su tipo de catálogo, y revisar historial y resúmenes.

**Architecture:** Un módulo `console` dentro de la API actual, con `platformProcedure` (sesión + `is_platform_admin` releído de la BD en cada petición) y consultas por `platformDb()` (rol `platform`, `BYPASSRLS`). Las escrituras reutilizan `setFeature`, `unsetFeature`, `setCatalogKind` y `createTenant`, y se auditan en la tabla nueva `platform_audit_log`. La web añade el segmento `/console` con su layout, guard y pantallas, en `features/console/`.

**Tech Stack:** Express 5, tRPC v11, Drizzle (PostgreSQL con RLS), Vitest; Next.js 15, React 19, AntD v6, Tailwind v4, i18next, lucide-react, dayjs.

**Spec:** `docs/superpowers/specs/2026-11-17-multitenant-fase4b-consola-design.md`. Antes de tocar código leer `docs/backend/architecture.md` (§11–13) y `docs/frontend/architecture.md` + `docs/frontend/styling-guide.md`.

## Global Constraints

- Ruta web: `/console` (`/console/organizations`, `/console/organizations/[id]`). Solo entra quien tiene `user.is_platform_admin = true`; ese flag nunca se asigna desde la web.
- Comentarios solo en inglés y solo para explicar el porqué; nada que cite el chat o la sesión. Documentos y textos de i18n: español (`es`) e inglés (`en`).
- Web: mobile-first; sin inline styles, CSS modules ni colores hex; sin `uppercase`; iconos `lucide-react`; fechas con `useDateFormatter`; tablas con `DataTable` (card en móvil); un componente nunca llama a `useTRPC()` (solo los hooks de la feature).
- Esquema: cambio en el TS → `pnpm --filter api db:generate` → revisar el SQL → `db:migrate`. Sin `db:push`.
- Sin planes, labs, perfil/branding, facturación ni reautenticación (fuera de alcance).
- No levantar servidores ni abrir el navegador; no leer archivos `.env`. `pnpm check-types` se puede correr libremente.
- Git: sin worktrees; en cada paso "Commit" preguntar al usuario y esperar OK explícito; sin OK, dejar los cambios sin commitear. Mensajes de commit sin líneas de atribución.
- Comandos de prueba: `pnpm --filter api test` (unitarias), `pnpm --filter api test:int -- <ruta>` (integración; requiere `TEST_DATABASE_URL` ya configurado), `pnpm --filter web test`, `pnpm --filter @repo/guards test`.

## Review Focus

- Un usuario con `is_platform_admin` revocado en la BD pero con cookie de sesión que aún lo dice `true` debe recibir `FORBIDDEN` (Tarea 2).
- Un admin de plataforma con `mustChangePassword = true` no puede usar la consola (Tarea 2).
- El enlace de configuración inicial (`setupUrl`, lleva un token) no se guarda nunca en `platform_audit_log` (Tarea 3).
- Un `organizationId` inexistente devuelve `NOT_FOUND` con `ErrorCodes.tenant.NOT_FOUND`, no un 500 (Tareas 3 y 4).
- Una búsqueda con `%` o `_` en el listado se trata como texto literal, no como comodín (Tarea 3).

---

## Estructura de archivos

**API** (`apps/api/src/`)
- `db/schema/platformAuditLog.ts` (nuevo): tabla `platform_audit_log`.
- `core/trpc/trpc.ts` (modificar): `platformProcedure`. `core/trpc/context.ts`: `platformDatabase?` opcional en el tipo `Context` (inyección en pruebas).
- `core/trpc/platformAudit.ts` (nuevo): `recordPlatformAudit`, `recordOrganizationView`, `resetPlatformAuditSessions`.
- `lib/features/expiry.ts` (nuevo): `parseExpiryDate` movido desde `db/scripts/feature.ts`.
- `modules/console/console.router.ts` y, por sub-router, `organizations/`, `features/`, `catalog/`, `history/`, `summary/` con `*.repository.ts`, `*.service.ts`, `*.router.ts` (+ `*.resource.ts` donde se dé forma a la salida). `console.module.ts` expone `consoleModule(ctx)`.
- `core/trpc/router.ts` (modificar): registra `console: consoleRouter`.

**Compartido:** `packages/schemas/src/console.ts` (contratos Zod; exportar desde `index.ts`), `packages/guards/src/features/expiry.ts` (`expiryStatus`).

**Web** (`apps/web/src/`): `app/console/**` (páginas thin), `features/console/{components,hooks,helpers.ts,types.ts,index.ts,test}`, `locales/{es,en}/console.json`.

---

### Task 1: Tabla `platform_audit_log`, migración y RLS

**Files:**
- Create: `apps/api/src/db/schema/platformAuditLog.ts`, `apps/api/src/db/rls/test/platformAuditLog.rls.int.test.ts`, migración `apps/api/drizzle/0017_*.sql` (generada)
- Modify: `apps/api/src/db/schema/index.ts`, `apps/api/src/db/rls/policy.ts`, `apps/api/src/db/scripts/verifyMultitenant.ts`, `apps/api/src/db/rls/test/rlsMigration.int.test.ts`

**Interfaces:**
- Produces: `platformAuditLog` (columnas `id` uuid, `userId` text FK `user` restrict, `action` text, `tenantId` text nullable FK `organization` restrict, `payload` jsonb nullable, `createdAt` timestamp; índices `(tenantId, createdAt)`, `(userId)`, `(createdAt)`); `PLATFORM_AUDIT_ACTIONS = ['organization.create','organization.view','feature.set','feature.unset','catalog.set'] as const` y `type PlatformAuditAction`.

- [ ] **Step 1: Prueba RLS (falla).** `platformAuditLog.rls.int.test.ts`, calcada de `features.rls.int.test.ts`: `it('app role reads no rows and cannot insert')` (SELECT devuelve 0 filas tras insertar una con el rol `platform`; INSERT con el rol `app` falla) e `it('platform role reads and writes it, with a null tenant_id')`.
- [ ] **Step 2: Correr y ver el fallo.** `pnpm --filter api test:int -- src/db/rls/test/platformAuditLog.rls.int.test.ts` → FAIL (tabla inexistente).
- [ ] **Step 3: Definir la tabla** en `platformAuditLog.ts` con `.enableRLS()` y **sin** política; exportarla en `schema/index.ts`. Comentario en inglés: sin RLS de tenant porque `tenant_id` es opcional y solo `platform` accede.
- [ ] **Step 4: Alcance de `PLATFORM_MANAGED_TABLES`.** Añadir `'platform_audit_log'` y revisar cada sitio que itera esa lista (`rlsMigration.int.test.ts`, `verifyMultitenant.ts` ~L500-540, helpers de `src/test/rlsPolicies.ts`) para que no asuman una columna `tenant_id` NOT NULL; la tabla debe contarse como "RLS activo y forzado, sin ninguna política" igual que `tenant_feature_events`. Actualizar el texto de ayuda de `mt:verify` y el test `rlsMigration` en consecuencia.
- [ ] **Step 5: Migración.** `pnpm --filter api db:generate`; en el SQL generado, añadir a mano `ALTER TABLE "platform_audit_log" FORCE ROW LEVEL SECURITY;` (patrón de `0006_tenant_features.sql`); revisar el SQL; `pnpm --filter api db:migrate`.
- [ ] **Step 6: Verificar.** El test del Step 1, `rlsMigration.int.test.ts` y `pnpm --filter api test` → PASS; `pnpm check-types` limpio.
- [ ] **Step 7: Commit** (preguntar): `feat(api): add platform_audit_log table with forced RLS`.

---

### Task 2: `platformProcedure` y auditoría

**Files:**
- Modify: `apps/api/src/core/trpc/trpc.ts`, `apps/api/src/core/trpc/context.ts`, `apps/api/src/test/trpcCaller.ts`, `apps/api/src/test/db.ts`
- Create: `apps/api/src/core/trpc/platformAudit.ts`, `apps/api/src/core/trpc/test/platformProcedure.int.test.ts`, `apps/api/src/core/trpc/test/platformAudit.int.test.ts`

**Interfaces:**
- Consumes: `platformAuditLog`, `PlatformAuditAction` (Tarea 1); `platformDb()` de `db/platform.ts`.
- Produces:
  - `platformProcedure`: `authedProcedure` + relectura del usuario (`isPlatformAdmin`, `mustChangePassword`, `email`, `name`) desde `ctx.platformDatabase ?? platformDb()`; añade al ctx `platformDb: Database` y `platformUser: { id: string; email: string; name: string }`. `FORBIDDEN` genérico si no es admin; `FORBIDDEN` con `ErrorCodes.user.MUST_CHANGE_PASSWORD` si debe cambiar la contraseña.
  - `recordPlatformAudit(executor: Executor, entry: { userId: string; action: PlatformAuditAction; tenantId?: string | null; payload?: Record<string, unknown> }): Promise<void>` (escribe en el executor recibido, para ir en la misma transacción que el cambio).
  - `recordOrganizationView(entry: { userId: string; sessionId: string; tenantId: string }, database: Database): Promise<void>`: una fila `organization.view` por sesión y organización (mapa en memoria con la misma política de evicción que `platformAccess.ts`; transacción propia).
  - `resetPlatformAuditSessions(): void` (se llama desde `resetDb`).
  - Test helper `consoleCallerFor(user: { id: string; isPlatformAdmin?: boolean }, opts?: { database?: Database; sessionId?: string })` en `test/trpcCaller.ts`: contexto sin `tenant`, con `platformDatabase = database ?? testDb`, sobre `appRouter`.

- [ ] **Step 1: Pruebas (fallan).** En `platformProcedure.int.test.ts`, con un router de prueba `router({ probe: platformProcedure.query(({ ctx }) => ctx.platformUser.id) })`: `it('rejects without a session')` (UNAUTHORIZED), `it('rejects a member who is not a platform admin')` (FORBIDDEN, incluido un dueño de organización), `it('rejects when the flag was revoked in the database but the session still says true')`, `it('rejects an admin that must change password')`, `it('admits a platform admin without any membership')`. En `platformAudit.int.test.ts`: `it('writes the row in the caller transaction and rolls back with it')`, `it('records an organization view once per session and tenant')`, `it('records again for another session or tenant')`.
- [ ] **Step 2: Correr y ver el fallo.** `pnpm --filter api test:int -- src/core/trpc/test/platformProcedure.int.test.ts src/core/trpc/test/platformAudit.int.test.ts` → FAIL.
- [ ] **Step 3: Implementar** lo de Interfaces. `platformProcedure` va en `trpc.ts` junto a `tenantProcedure`; el comentario explica por qué el flag se relee (la sesión puede estar desfasada). Añadir `platformDatabase?: Database` al tipo `Context`, `consoleCallerFor` y la llamada a `resetPlatformAuditSessions()` en `resetDb`.
- [ ] **Step 4: Verificar.** Los dos tests → PASS; `pnpm --filter api test` y `pnpm check-types` limpios.
- [ ] **Step 5: Commit** (preguntar): `feat(api): add platformProcedure and console audit helpers`.

---

### Task 3: Sub-router `organizations`

**Files:**
- Create: `packages/schemas/src/console.ts`, `apps/api/src/modules/console/{console.module.ts,console.router.ts}`, `apps/api/src/modules/console/organizations/{organizations.repository.ts,organizations.service.ts,organizations.resource.ts,organizations.router.ts}`, `apps/api/src/modules/console/test/organizations.int.test.ts`
- Modify: `packages/schemas/src/index.ts`, `apps/api/src/core/trpc/router.ts`

**Interfaces:**
- Consumes: `platformProcedure`, `recordPlatformAudit`, `recordOrganizationView` (Tarea 2); `createTenant(input, database)` y `CreateTenantInput` de `lib/tenancy/createTenant.ts`; `resolveFeatures` de `@repo/guards`; `ErrorCodes.tenant.*`.
- Produces (en `@repo/schemas`):
  - `consoleOrganizationListQuerySchema = listQuerySchema.extend({ sortBy: z.enum(['name','createdAt']).default('createdAt'), catalogKind: catalogKindSchema.optional() })` → `ConsoleOrganizationListQuery`.
  - `consoleOrganizationIdSchema = z.object({ organizationId: z.string().min(1) })`.
  - `createOrganizationInputSchema` = `{ slug, name, adminEmail, adminName, catalogKind? }` → `CreateOrganizationInput`.
  - Salida `ConsoleOrganization = { id; slug; name; catalogKind; activeFeatureCount: number; nextExpiry: string | null; createdAt: string }`.
- Produces (API): `console.organizations.list` (query → `Paginated<ConsoleOrganization>`), `.get` (query, por `organizationId`, registra `recordOrganizationView`), `.create` (mutation → `{ tenantId: string; setupUrl: string | null }`).

- [ ] **Step 1: Pruebas (fallan)** en `organizations.int.test.ts`, con `consoleCallerFor` y dos organizaciones: `it('lists every organization with its catalog kind and active feature count')`, `it('filters by search and treats % and _ literally')`, `it('rejects a non platform admin on list, get and create')`, `it('get returns NOT_FOUND with the tenant error code for an unknown id')`, `it('get records one organization.view audit row per session')`, `it('create provisions the organization and returns the setup link')`, `it('create audits organization.create without the setup link in the payload')`, `it('create maps a taken slug to CONFLICT with ErrorCodes.tenant.SLUG_TAKEN')`.
- [ ] **Step 2: Correr y ver el fallo.** `pnpm --filter api test:int -- src/modules/console/test/organizations.int.test.ts` → FAIL.
- [ ] **Step 3: Contratos Zod** en `console.ts` según Interfaces (mensajes de validación como claves i18n, como en los demás schemas).
- [ ] **Step 4: Repository** `OrganizationsRepository(database: Database)`: listado paginado con búsqueda `ILIKE` sobre nombre y slug **escapando** `%`, `_` y `\`; une `tenant_profile` (default de `DEFAULT_CATALOG_KIND`) y agrega las features activas con `resolveFeatures` (solo las toggleables) y el vencimiento más próximo entre las activas; `findById(id)`.
- [ ] **Step 5: Service y router.** `get` y `create` usan `ctx.platformUser`. `create` llama a `createTenant(input, ctx.platformDb)` y **después** registra `organization.create` con `{ slug, name, adminEmail, catalogKind }` (sin `setupUrl`); no puede ir en la misma transacción porque `createTenant` provisiona la cuenta fuera de ella. Registrar `console: consoleRouter` en `core/trpc/router.ts`.
- [ ] **Step 6: Verificar.** El test → PASS; `pnpm --filter api test` y `pnpm check-types` limpios.
- [ ] **Step 7: Commit** (preguntar): `feat(api): console organizations list, detail and create`.

---

### Task 4: Sub-routers `features` y `catalog`

**Files:**
- Create: `apps/api/src/lib/features/expiry.ts`, `apps/api/src/modules/console/features/{features.repository.ts,features.service.ts,features.router.ts}`, `apps/api/src/modules/console/catalog/{catalog.service.ts,catalog.router.ts}`, `apps/api/src/modules/console/test/features.int.test.ts`
- Modify: `apps/api/src/db/scripts/feature.ts` (importa `parseExpiryDate` desde `lib/features/expiry.ts`; su test existente debe seguir pasando), `apps/api/src/modules/console/console.router.ts`, `packages/schemas/src/console.ts`

**Interfaces:**
- Consumes: `setFeature`, `unsetFeature`, `BILLING_PERIODS` de `lib/features/admin.ts`; `setCatalogKind`; `clearFeatureCache(tenantId)` de `lib/features/cache.ts`; `recordPlatformAudit`; `OrganizationsRepository.findById` (Tarea 3).
- Produces (schemas): `setConsoleFeatureInputSchema = { organizationId; key: featureKeySchema; expiresOn?: 'YYYY-MM-DD' | null; priceCents?: int >= 0 | null; billingPeriod?: 'monthly' | 'yearly' | null; currency?: 3 letras | null }` (campo ausente conserva el valor; `null` lo borra), `unsetConsoleFeatureInputSchema = { organizationId; key }`, `setConsoleCatalogKindInputSchema = { organizationId; kind: catalogKindSchema }`; salida `ConsoleFeature = { key; kind; active: boolean; enabled: boolean; activatedAt: string | null; expiresAt: string | null; priceCents: number | null; billingPeriod: string | null; currency: string | null }`.
- Produces (API): `console.features.list` (query, devuelve **todas** las features toggleables del catálogo, con `enabled: false` y campos nulos si no hay fila), `console.features.set`, `console.features.unset`, `console.catalog.setKind`.
- `parseExpiryDate(value: string): Date` en `lib/features/expiry.ts` (misma semántica que hoy: el día dado es el **último día activo**; se guarda el inicio del día siguiente en UTC).

- [ ] **Step 1: Pruebas (fallan)** en `features.int.test.ts`: `it('lists every toggleable feature, off ones included')`, `it('set enables a feature with expiry and price, and audits feature.set')`, `it('treats expiresOn as the last active day')` (el día siguiente a las 00:00 UTC es el límite), `it('rejects a feature whose dependency is inactive with MISSING_DEPENDENCY')`, `it('rejects disabling quotes while events is active with HAS_DEPENDENTS')`, `it('rejects a core or unknown key')`, `it('unset disables the feature and audits feature.unset')`, `it('clears the feature cache so the tenant sees the change on its next request')` (llamar a `features.mine` como miembro antes y después, con la caché ya caliente), `it('rolls back the change when the audit write fails')`, `it('setKind changes the catalog kind and audits catalog.set')`, `it('rejects a non platform admin and an unknown organization')`.
- [ ] **Step 2: Correr y ver el fallo.** `pnpm --filter api test:int -- src/modules/console/test/features.int.test.ts` → FAIL.
- [ ] **Step 3: Mover `parseExpiryDate`** a `lib/features/expiry.ts` y reapuntar el script; correr su test unitario existente.
- [ ] **Step 4: Service.** Resuelve el `slug` de la organización por id (los servicios existentes reciben slug) y envuelve cada escritura en `ctx.platformDb.transaction(async (tx) => { await setFeature(tx, …); await recordPlatformAudit(tx, …) })` (el `.transaction` anidado es un savepoint, así cambio y auditoría son atómicos). `actor` = `ctx.platformUser.email`. Tras el commit, `clearFeatureCache(organizationId)`. Payload de auditoría: la clave y los valores nuevos (nunca datos de otras organizaciones).
- [ ] **Step 5: Verificar.** El test → PASS; `pnpm --filter api test` (incluye el de `feature.ts`) y `pnpm check-types` limpios.
- [ ] **Step 6: Commit** (preguntar): `feat(api): console features and catalog kind with audit and cache invalidation`.

---

### Task 5: `history`, `summary` y utilidad de vencimiento

**Files:**
- Create: `packages/guards/src/features/expiry.ts` (+ su test junto a los de `features`), `apps/api/src/modules/console/history/{history.repository.ts,history.service.ts,history.router.ts}`, `apps/api/src/modules/console/summary/{summary.repository.ts,summary.service.ts,summary.router.ts}`, `apps/api/src/modules/console/test/historySummary.int.test.ts`
- Modify: `packages/guards/src/index.ts`, `packages/schemas/src/console.ts`, `apps/api/src/modules/console/console.router.ts`

**Interfaces:**
- Produces (guards): `EXPIRING_SOON_DAYS = 30` y `expiryStatus(expiresAt: Date | null, now: Date): { state: 'permanent' } | { state: 'active'; daysLeft: number } | { state: 'expiringSoon'; daysLeft: number } | { state: 'expired' }` (`daysLeft` = días enteros hasta `expiresAt`, redondeo hacia arriba).
- Produces (schemas): `consoleHistoryQuerySchema = { organizationId; limit?: int 1..100 (default 50) }`; `ConsoleHistoryItem = { source: 'feature' | 'access' | 'audit'; id: string; createdAt: string; actor: string; label: string; detail: Record<string, unknown> | null }`; `ConsoleGlobalSummary = { organizations: number; products: number; quotes: number; events: number; expiringFeatures: { organizationId; organizationName; featureKey; expiresAt: string }[] }`; `ConsoleOrganizationSummary = { products: number; clients: number; quotesByStatus: Record<string, number>; events: number }`.
- Produces (API): `console.history.list`, `console.summary.global`, `console.summary.organization` (por `organizationId`).

- [ ] **Step 1: Pruebas (fallan).** Guards: `it('is permanent without an expiry')`, `it('is active beyond 30 days')`, `it('is expiringSoon within 30 days with the days left')`, `it('is expired at and after the expiry instant')`. API (`historySummary.int.test.ts`): `it('merges feature events, platform access and console audit of one organization newest first')`, `it('does not include rows of another organization')`, `it('respects the limit')`, `it('global summary totals every organization and lists features expiring soon')`, `it('organization summary counts only that organization, quotes by status')`, `it('returns zeros for an organization without data')`, `it('rejects a non platform admin')`.
- [ ] **Step 2: Correr y ver el fallo.** `pnpm --filter @repo/guards test` y `pnpm --filter api test:int -- src/modules/console/test/historySummary.int.test.ts` → FAIL.
- [ ] **Step 3: Implementar `expiryStatus`** y exportarla.
- [ ] **Step 4: History.** Tres consultas acotadas a la organización (`tenant_feature_events`, `platform_access_log`, `platform_audit_log`), cada una con `limit`, mezcladas por `createdAt` desc y recortadas al `limit`. `label` es una clave estable (p. ej. `feature.enabled`, `access.query`, `audit.catalog.set`) que la web traduce.
- [ ] **Step 5: Summary.** Conteos con `platformDb()`; cada consulta filtra por organización o agrupa explícitamente; `expiringFeatures` usa `expiryStatus` (solo `expiringSoon`, máximo 20, más próximas primero).
- [ ] **Step 6: Verificar.** Ambos tests → PASS; `pnpm --filter api test` y `pnpm check-types` limpios.
- [ ] **Step 7: Commit** (preguntar): `feat(api): console history, summary and expiry status`.

---

### Task 6: Web — layout, guard, redirección y portada

**Files:**
- Create: `apps/web/src/app/console/{layout.tsx,page.tsx}`, `apps/web/src/features/console/{components/ConsoleLayout.tsx,components/ConsoleGuard.tsx,components/ConsoleHomePage.tsx,hooks/useConsoleSummary.ts,helpers.ts,types.ts,index.ts}`, `apps/web/src/features/console/test/{helpers.test.ts,redirect.test.ts}`, `apps/web/src/components/shared/HomeRedirect.tsx`, `apps/web/src/locales/{es,en}/console.json`
- Modify: `apps/web/src/lib/auth/navigation.ts`, `apps/web/src/middleware.ts`, `apps/web/src/app/page.tsx`, `apps/web/src/features/auth/components/AuthPage.tsx`, `apps/web/src/lib/i18n/config.ts`, el menú de `apps/web/src/components/UserProfile/` (enlace "Volver a la consola" solo con `useIsPlatformAdmin()`)

**Interfaces:**
- Produces: `CONSOLE_ROUTE = '/console'` y `ROOT_ROUTE = '/'` en `navigation.ts` (`/console` entra en `PROTECTED_ROUTES`); `homeRouteFor(user: { isPlatformAdmin?: boolean | null }): string` (`/console` para un admin de plataforma, `DEFAULT_REDIRECT_HOME` para el resto); `resolveConsoleAccess(input: { isPending: boolean; isPlatformAdmin: boolean }): 'loading' | 'allow' | 'notFound'` en `features/console/helpers.ts`; hook `useConsoleGlobalSummary()`.
- Consumes: `console.summary.global` (Tarea 5), `useSession`/`useIsPlatformAdmin`, `NotFound`, `UserProfile`, `Logo`.

- [ ] **Step 1: Pruebas (fallan).** `redirect.test.ts`: `it('sends a platform admin to /console')`, `it('sends any other user to /admin')`, `it('treats a missing flag as not admin')`. `helpers.test.ts`: `it('is loading while the session is pending')`, `it('allows a platform admin')`, `it('shows not found to anyone else')`.
- [ ] **Step 2: Correr y ver el fallo.** `pnpm --filter web test` → FAIL.
- [ ] **Step 3: Funciones puras y rutas.** Implementar `homeRouteFor` y `resolveConsoleAccess`. En `middleware.ts`, los dos redirects que hoy van a `DEFAULT_REDIRECT_HOME` (usuario con sesión en rutas de auth y salida de `/account-locked`) pasan a `ROOT_ROUTE`, para que decida `HomeRedirect`. `app/page.tsx` renderiza `HomeRedirect` (cliente: espera la sesión y hace `router.replace(homeRouteFor(user))`); `AuthPage` hace `router.replace(ROOT_ROUTE)` tras el login. Un usuario sin sesión debe seguir yendo a `/login` (lo resuelve el middleware antes de llegar a `/`).
- [ ] **Step 4: Layout y guard.** `app/console/layout.tsx` envuelve en `ConsoleGuard` + `ConsoleLayout` (sin `TenantGate`): cabecera móvil-primero con `Logo`, navegación Portada / Organizaciones, enlace "Entrar a una organización" a `SELECT_ORGANIZATION_ROUTE` y el menú de usuario. `ConsoleGuard` aplica `resolveConsoleAccess` (spinner / hijos / `NotFound` con `home={ROOT_ROUTE}`).
- [ ] **Step 5: Portada.** `ConsoleHomePage` con tarjetas de totales (organizaciones, productos, cotizaciones, eventos) y la lista de features por vencer (etiqueta con `expiryStatus`); cada tarjeta muestra su error sin tumbar la pantalla; estados de carga y vacío. Textos en `console.json` (es/en) y registro del namespace en `lib/i18n/config.ts`.
- [ ] **Step 6: Verificar.** `pnpm --filter web test` y `pnpm --filter web check-types` limpios. No abrir el navegador: dejar el checklist manual para la Tarea 8.
- [ ] **Step 7: Commit** (preguntar): `feat(web): console shell, platform-admin guard and home redirect`.

---

### Task 7: Web — organizaciones (listado, crear y detalle)

**Files:**
- Create: `apps/web/src/app/console/organizations/page.tsx`, `apps/web/src/app/console/organizations/[id]/page.tsx`, y en `apps/web/src/features/console/`: `components/{OrganizationsPage.tsx,OrganizationsTable.tsx,columns.tsx,OrganizationCard.tsx,CreateOrganizationModal.tsx,OrganizationForm.tsx,SetupLinkResult.tsx,OrganizationDetailPage.tsx,SummaryTab.tsx,FeaturesTab.tsx,FeatureForm.tsx,CatalogTab.tsx,HistoryTab.tsx,ExpiryTag.tsx}`, `hooks/{useOrganizations.ts,useOrganization.ts,useCreateOrganization.ts,useConsoleFeatures.ts,useSetFeature.ts,useUnsetFeature.ts,useSetCatalogKind.ts,useOrganizationHistory.ts,useOrganizationSummary.ts}`, `test/featureToggle.test.ts`
- Modify: `features/console/helpers.ts`, `features/console/index.ts`, `locales/{es,en}/console.json`

**Interfaces:**
- Consumes: todos los procedimientos de las Tareas 3–5; `expiryStatus`, `FEATURES` y `isToggleable` de `@repo/guards`; `DataTable`/`useDataTable`; `useApiError`.
- Produces: `featureToggleState(key: FeatureKey, activeKeys: ReadonlySet<FeatureKey>, enabledDependents: readonly FeatureKey[]): { canEnable: boolean; canDisable: boolean; missing: FeatureKey[]; blockedBy: FeatureKey[] }` (pura, en `helpers.ts`): `missing` son requisitos inactivos, `blockedBy` son dependientes activos.

- [ ] **Step 1: Pruebas (fallan)** en `featureToggle.test.ts`: `it('cannot enable events while quotes is inactive and names quotes')`, `it('can enable events when quotes is active')`, `it('cannot disable quotes while events is active and names events')`, `it('can disable a feature with no active dependents')`.
- [ ] **Step 2: Correr y ver el fallo.** `pnpm --filter web test` → FAIL.
- [ ] **Step 3: `featureToggleState`** en `helpers.ts`.
- [ ] **Step 4: Listado y creación.** `OrganizationsPage` (`PageHeader` con acción "Crear organización"), `OrganizationsTable` con `DataTable` + `useDataTable<'name' | 'createdAt'>`, búsqueda, filtro por tipo de catálogo, `columns.tsx` con `useOrganizationColumns` (nombre, slug, tipo, features activas, `ExpiryTag` del próximo vencimiento, acciones) y `OrganizationCard` en móvil; la fila abre `/console/organizations/[id]`. `CreateOrganizationModal` monta `OrganizationForm` solo con `open`; al éxito muestra `SetupLinkResult` con el enlace copiable. Los errores de la API (slug repetido, datos inválidos) se muestran en el campo vía `useApiError`.
- [ ] **Step 5: Detalle con pestañas** (`Tabs`): `SummaryTab` (totales y cotizaciones por estado), `FeaturesTab` (una fila por feature con `Switch`, `ExpiryTag`, precio y periodo; el deshabilitado y su razón salen de `featureToggleState`; `FeatureForm` en modal para vencimiento "último día activo", precio, periodo y moneda), `CatalogTab` (productos o servicios), `HistoryTab` (línea de tiempo con las claves `label` traducidas). Toda mutación invalida `console.organizations`, `console.features`, `console.summary` y `console.history` vía `queryFilter()`. Botón "Entrar a esta organización" que usa `useSelectTenant` y navega a `DEFAULT_REDIRECT_HOME`.
- [ ] **Step 6: Textos.** Todo en `console.json` (es/en); fechas con `useDateFormatter`; sin strings sueltos.
- [ ] **Step 7: Verificar.** `pnpm --filter web test` y `pnpm check-types` limpios.
- [ ] **Step 8: Commit** (preguntar): `feat(web): console organizations list, creation and detail`.

---

### Task 8: Documentación y checklist

**Files:**
- Modify: `docs/backend/architecture.md` (sección nueva §15 "Consola de plataforma"), `docs/superpowers/runbooks/multitenant-cutover.md` o el runbook multitenant vigente (cómo crear organizaciones y activar features desde `/console`), `docs/frontend/architecture.md` (mención breve del segmento `/console` fuera de `admin`)

- [ ] **Step 1: Backend.** Documentar `platformProcedure`, el uso de `platformDb()` con filtro explícito, `platform_audit_log` (qué se registra y qué no), `ctx.platformDatabase` para pruebas y la receta para añadir un procedimiento a la consola.
- [ ] **Step 2: Runbook y frontend.** Reflejar que `/console` reemplaza a los scripts `tenant:create`, `feature:*` y `tenant:set-catalog-kind` para el uso diario (los scripts siguen existiendo), y la regla de que el flag `is_platform_admin` solo se asigna fuera de la app.
- [ ] **Step 3: Checklist manual** (lo ejecuta el usuario; entregarlo en el mensaje final): login como `platform@demo.test` aterriza en `/console`; un usuario normal que abre `/console` ve la 404; móvil y escritorio del listado; crear organización y copiar el enlace; activar `events` sin `quotes` muestra el error junto al interruptor; cambiar una feature y verlo reflejado al instante en la organización; historial muestra los cambios; "Entrar a esta organización" y "Volver a la consola".
- [ ] **Step 4: Verificar todo.** `pnpm check-types`, `pnpm test` y `pnpm --filter api test:int` en verde.
- [ ] **Step 5: Commit** (preguntar): `docs: console architecture notes and runbook`.
