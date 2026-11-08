# Multi-tenant Fase 2: roles y permisos en base de datos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pasar roles y matriz rol→permisos a la base de datos, por organización y editables desde el portal, evaluando el rol de la membresía y no `user.role`.

**Architecture:** Tablas `role`, `role_permission`, `role_audit_log` y `member.role_id`. La API resuelve `ctx.access` en `protectedProcedure` (una lectura por petición) y evalúa con funciones puras de `@repo/guards`. La web pide `tenant.permissions`, lo cachea en React Query y se mantiene al día con la cabecera `x-permissions-version`.

**Tech Stack:** Drizzle + Postgres, tRPC v11, Express 5, Better Auth (plugin `organization` se mantiene), Next.js 15, React Query, AntD v6, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-multitenant-fase2-roles-design.md`

## Global Constraints

- Sin commits ni pushes: `CLAUDE.md` exige OK explícito por acción. Cada tarea termina en un **Checkpoint** (type-check y tests en verde, cambios sin commitear), no en un commit.
- No levantar servidores ni probar en vivo; no leer `.env`. `pnpm check-types` y los tests (Vitest) se corren libremente.
- Esquema: cambiar el TS → `pnpm --filter api db:generate` → revisar el SQL → `db:migrate`. Nunca `db:push` (§8 de `docs/backend/architecture.md`).
- Backend: seguir `docs/backend/architecture.md` (§3 módulos, §11 multi-tenant, repository `(db, tenantId)` con `tenantEq`, ids de `input` resueltos por lecturas acotadas al tenant, `AppError`/`ErrorCodes`). Front: `docs/frontend/architecture.md` y `docs/frontend/styling-guide.md`.
- Web: mobile-first, `lucide-react`, fechas con `useDateFormatter`, sin `uppercase`, sin hex ni inline styles, i18n es/en, recursos y acciones solo vía `RESOURCES`/`ACTIONS`.
- Comentarios en inglés y solo para el *por qué*; nunca referencias a la conversación ni a este plan.
- Nombres exactos del spec: tablas `role`, `role_permission`, `role_audit_log`; columna `member.role_id` (`ON DELETE RESTRICT`); cabecera `x-permissions-version` con valor `<roleId>:<version>`; error `ROLE_VERSION_CONFLICT`; sondeo de versión cada 30–60 s; sin caché de permisos en la API al inicio; un miembro sin rol válido da 403 (falla cerrado).
- Reglas de producto firmes: el admin solo toca lo de su membresía en cuentas compartidas; nombre, contraseña y enlace siguen siendo globales; asociar un email existente sigue siendo solo del admin de plataforma.

### Desviaciones deliberadas respecto al spec (confirmar al revisar)

- Las tablas nuevas usan `tenant_id` (helper `tenantId()`), no `organization_id`: `db/schema/test/tenantTables.test.ts` exige esa columna en toda tabla no exenta, y deja el esquema listo para RLS. `role_permission` y `role_audit_log` también la llevan (denormalizada).
- `grants` es un `Record<string, 'own' | 'all'>` con clave `"<resource>.<action>"` y no un `Map`: es lo que viaja serializado por tRPC a la web.
- El rol dueño no guarda filas en `role_permission`: su permiso es el bypass `isOwner` (cubre acciones nuevas del catálogo sin migrar).

## Review Focus

1. Miembro cuyo `role_id` apunta a un rol de otra organización o inexistente → 403, nunca un permiso por defecto (Task 5).
2. Dos admins editando el mismo rol a la vez → el segundo recibe `ROLE_VERSION_CONFLICT` y no pisa en silencio (Task 6).
3. Quitar el rol dueño o la membresía al último dueño, por `users.update` o `users.remove`, con la organización compartida con otra (Task 8).
4. Fila de `role_permission` cuyo recurso o acción ya no existe en el catálogo (se retiró en código) → se ignora al evaluar, no rompe la petición (Task 1 y 5).
5. Admin de plataforma que además es miembro: usa el rol de su membresía y no se audita; sin membresía: bypass y auditado (Task 5).

---

## Mapa de archivos

| Área | Archivos |
|---|---|
| `packages/guards` | crear `src/core/evaluate.ts`, `src/core/catalog.ts`, `src/mappings/roleTemplates.ts`; modificar `permissions.matrix.ts` (+`ROLE`), `constants/resources.ts`, `index.ts` |
| `packages/schemas` | crear `src/roles.ts`; modificar `src/users.ts`, `src/index.ts` |
| API esquema | crear `db/schema/roles.ts`; modificar `db/schema/auth.ts`, `db/schema/index.ts`; migraciones `0002`–`0004` |
| API acceso | crear `lib/rbac/access.ts`, `lib/rbac/seedTenantRoles.ts`; modificar `core/trpc/trpc.ts`, `core/trpc/tenantCtx.ts`, `core/express/middleware/guardTenantSession.ts`, `modules/tenant/*`, routers de quotes y events |
| API roles | crear `modules/roles/{roles.module,roles.repository,roles.service,roles.router,roles.resource}.ts` y `test/`; registrar en el `appRouter` |
| API usuarios | modificar `modules/users/*`, `lib/tenancy/createTenant.ts`, `db/seeds/{users,demo}.ts`, `test/db.ts`, `db/scripts/verifyMultitenant.ts` |
| Web núcleo | crear `features/tenant/hooks/usePermissions.ts`, `lib/auth/RouteGuard.tsx`; modificar `lib/auth/{useCan,Can,useIsSuperAdmin,route-access}.ts*`, `lib/navigation/hooks/useNavigation.ts`, `features/tenant/components/TenantGate.tsx`, `lib/trpc/provider.tsx`, `middleware.ts` |
| Web roles | crear `features/roles/**` (page, table, form, hooks, types) y las rutas, navegación y textos es/en |
| Web usuarios/ajustes | modificar `features/users/**`, `features/settings/components/PermissionsMatrixCard.tsx`, `components/shared/RoleTag.tsx` |

---

### Task 1: Evaluador puro y catálogo en `@repo/guards`

**Files:**
- Create: `packages/guards/src/core/evaluate.ts`, `packages/guards/src/core/catalog.ts`, `packages/guards/src/mappings/roleTemplates.ts`
- Modify: `packages/guards/src/constants/resources.ts` (añadir `ROLE: 'role'`), `packages/guards/src/mappings/permissions.matrix.ts` (`{ resource: RESOURCES.ROLE, actions: CRUD }`), `packages/guards/src/index.ts`, `packages/guards/package.json` (script `test` con Vitest)
- Test: `packages/guards/src/core/test/evaluate.test.ts`, `packages/guards/src/core/test/catalog.test.ts`, `packages/guards/src/mappings/test/roleTemplates.test.ts`

**Interfaces:**
- Produces:
  - `type AccessGrants = { isOwner: boolean; grants: Record<string, ResourceScope> }`
  - `permissionKey(resource: string, action: string): string` → `"quote.read"`
  - `can(access: AccessGrants | null | undefined, check: PermissionCheck): boolean`
  - `scopeFor(access: AccessGrants | null | undefined, resource: string, action: string): ResourceScope | null` (`'all'` para dueño; `null` si no está concedido)
  - `isCatalogPermission(resource: string, action: string): boolean`, `catalogResources(): string[]`, `catalogActions(resource: string): readonly string[]`
  - `ROLE_TEMPLATES: readonly { key: RoleType; name: string; isOwner: boolean; permissions: { resource: string; action: string; scope: ResourceScope }[] }[]`; el dueño tiene `permissions: []`.

- [ ] **Step 1: Write failing tests.** `evaluate.test.ts`: `can` es `true` con `isOwner`; `true` solo si todas las acciones pedidas están concedidas; `false` con `null`/`undefined`; ignora claves de `grants` que no están en el catálogo (review focus 4); `scopeFor` devuelve `'all'` al dueño, `'own'`/`'all'` según el grant y `null` si no existe. `catalog.test.ts`: `isCatalogPermission('quote','read')` verdadero, `('quote','nope')` falso, `('role','update')` verdadero, y `user`/`session` de Better Auth siguen en el catálogo. `roleTemplates.test.ts`: los 4 roles base, `isOwner` solo en superadmin, y los permisos de admin/operator/member son exactamente los de `rolesPermissionsMatrix` (incluido el `scope: 'own'` de operator sobre `quote` y `event`).
- [ ] **Step 2:** Run `pnpm --filter @repo/guards test` — Expected: FAIL (módulos inexistentes).
- [ ] **Step 3:** Implementar las firmas de Interfaces. `ROLE_TEMPLATES` se deriva de `rolesPermissionsMatrix` aplanando cada `ResourceGrant` (array = scope `all`). El catálogo sale de `statements` (incluye `user` y `session`).
- [ ] **Step 4:** Run `pnpm --filter @repo/guards test` — Expected: PASS. Run `pnpm check-types` — Expected: sin errores (`hasPermission` y `resolveResourceScope` siguen exportados; se retiran en la Task 13).
- [ ] **Checkpoint:** cambios sin commitear.

### Task 2: Esquema y migración aditiva

**Files:**
- Create: `apps/api/src/db/schema/roles.ts`
- Modify: `apps/api/src/db/schema/auth.ts` (en `member`: `roleId: text('role_id').references(() => role.id, { onDelete: 'restrict' })`, nullable por ahora, con índice), `apps/api/src/db/schema/index.ts`
- Generate: `apps/api/drizzle/0002_*.sql` con `pnpm --filter api db:generate`
- Test: `apps/api/src/db/schema/test/roles.schema.int.test.ts`

**Interfaces:**
- Produces: tablas Drizzle `role` (`id`, `tenantId`, `name`, `isOwner`, `version` default 1, `createdAt`, `updatedAt`; único `(tenantId, name)`; índice único parcial `(tenantId) where is_owner` para un solo dueño), `rolePermission` (`roleId` con `ON DELETE CASCADE`, `tenantId`, `resource`, `action`, `scope` enum `own|all` default `all`; PK `(roleId, resource, action)`), `roleAuditLog` (`id`, `tenantId`, `actorUserId`, `roleId` nullable, `action`, `before` jsonb, `after` jsonb, `createdAt`).

- [ ] **Step 1: Write failing tests.** `roles.schema.int.test.ts`: dos roles con el mismo nombre en una organización fallan y en dos organizaciones distintas pasan; un segundo rol `is_owner` en la misma organización falla; borrar un rol con permisos elimina sus `role_permission`; borrar un rol con un `member` asignado falla (`RESTRICT`). Correr también `db/schema/test/tenantTables.test.ts`: debe exigir `tenant_id` en las tres tablas nuevas.
- [ ] **Step 2:** Run `pnpm --filter api test:int -- roles.schema` — Expected: FAIL (tablas inexistentes).
- [ ] **Step 3:** Declarar las tablas con `tenantId()` de `tenantColumn.ts`; `pnpm --filter api db:generate`; revisar el SQL generado (índices, FK, enum).
- [ ] **Step 4:** Run `pnpm --filter api test:int -- roles.schema` y `pnpm --filter api test -- tenantTables` — Expected: PASS. `pnpm check-types` limpio.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 3: Siembra de roles, backfill, endurecimiento y `mt:verify`

**Files:**
- Create: `apps/api/src/lib/rbac/seedTenantRoles.ts`; migración de datos `apps/api/drizzle/0003_*.sql` (`drizzle-kit generate --custom`)
- Modify: `apps/api/src/db/schema/auth.ts` (`roleId` pasa a `.notNull()`), generar `0004_*.sql`; `apps/api/src/db/scripts/verifyMultitenant.ts`; `apps/api/src/test/db.ts`
- Test: `apps/api/src/lib/rbac/test/seedTenantRoles.int.test.ts`, `apps/api/src/db/schema/test/rolesBackfill.int.test.ts`, `apps/api/src/db/scripts/test/verifyMultitenant.test.ts` (ampliar)

**Interfaces:**
- Produces: `seedTenantRoles(tenantId: string, x?: Executor): Promise<Record<RoleType, string>>` (rol base → `roleId`; idempotente; crea las filas de `ROLE_TEMPLATES`). `addMember(userId, tenantId, roleKey: RoleType = 'member')` de `test/db.ts` crea los roles de la organización si faltan y asigna `role_id` (mantiene escribiendo `member.role` con la clave).

- [ ] **Step 1: Write failing tests.** `seedTenantRoles`: crea 4 roles con un solo dueño; llamarlo dos veces no duplica; las filas de `role_permission` de cada rol igualan `ROLE_TEMPLATES`. `rolesBackfill`: con fixtures de miembros cuyo `member.role` es `superadmin|admin|operator|member`, ejecutar el SQL de `0003` (dentro de una transacción que antes relaja `NOT NULL` de `role_id` y que se revierte) deja a cada miembro con el rol de su organización y su clave; un valor de rol desconocido hace fallar la migración con un error claro. `verifyMultitenant`: nuevas comprobaciones — ningún miembro sin `role_id`, cada rol pertenece a la organización del miembro, cada organización tiene un dueño con al menos un miembro.
- [ ] **Step 2:** Run `pnpm --filter api test:int -- seedTenantRoles rolesBackfill` y `pnpm --filter api test -- verifyMultitenant` — Expected: FAIL.
- [ ] **Step 3:** Implementar `seedTenantRoles` sobre `ROLE_TEMPLATES`. Escribir `0003` como SQL idempotente con la plantilla como instantánea (una migración congelada no debe depender del código vivo) que crea los roles de cada organización que no tenga y asigna `member.role_id` por clave, con `RAISE EXCEPTION` ante un valor desconocido. Pasar `roleId` a `notNull`, generar `0004`, ampliar `mt:verify` y `addMember`.
- [ ] **Step 4:** Run los comandos del Step 2 — Expected: PASS. Revisar el SQL de `0003` y `0004` con el usuario antes de `db:migrate`.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 4: Alta de organizaciones y siembra de usuarios con roles

**Files:**
- Modify: `apps/api/src/lib/tenancy/createTenant.ts` (dentro de la transacción: `seedTenantRoles(tenantId, tx)` y membresía del admin inicial con el `roleId` del dueño; elimina la reescritura de `user.role` y su rama especial), `apps/api/src/db/seeds/users.ts` (`ensureMembership(userId, tenantId, roleId)`, `SeedUser.role` sigue siendo la clave y se resuelve a `roleId`), `apps/api/src/db/seeds/demo.ts`
- Test: ampliar `apps/api/src/lib/tenancy/test/createTenant.int.test.ts`, `apps/api/src/db/seeds/test/seed.demo.int.test.ts`

**Interfaces:**
- Consumes: `seedTenantRoles` (Task 3).
- Produces: tras `createTenant`, la organización tiene 4 roles y su admin inicial tiene el rol dueño.

- [ ] **Step 1: Write failing tests.** `createTenant`: la organización queda con 4 roles, el admin inicial es miembro con el rol `is_owner`, y si la cuenta ya tenía otras membresías su `user.role` no se modifica. `seed.demo`: cada usuario demo tiene el rol de su clave en cada organización (`shared@demo.test` es operator en Norte y member en Sur, con roles distintos).
- [ ] **Step 2:** Run `pnpm --filter api test:int -- createTenant seed.demo` — Expected: FAIL.
- [ ] **Step 3:** Implementar los cambios. Mantener `member.role` escrito con la clave del rol mediante una única función (`lib/rbac/seedTenantRoles.ts` expone `roleKeyForLegacyColumns`) para que `member.role` no diverja mientras exista la columna.
- [ ] **Step 4:** Run los tests — Expected: PASS; `pnpm check-types` limpio.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 5: `ctx.access` y autorización por membresía en la API

**Files:**
- Create: `apps/api/src/lib/rbac/access.ts`
- Modify: `apps/api/src/core/trpc/trpc.ts` (`protectedProcedure` resuelve `ctx.access`; `guardedProcedure` usa `can`; fija la cabecera), `apps/api/src/core/trpc/tenantCtx.ts` (`TenantCtx` añade `access: ResolvedAccess`), `apps/api/src/core/express/middleware/guardTenantSession.ts`, `apps/api/src/modules/tenant/{tenant.router,tenant.service,tenant.repository}.ts`, `apps/api/src/modules/quotes/quotes.router.ts` y `apps/api/src/modules/events/events.router.ts` (el scope sale de `scopeFor(ctx.access, …, ACTIONS.READ)`)
- Test: `apps/api/src/lib/rbac/test/access.int.test.ts`; ampliar `apps/api/src/core/trpc/test/tenantChain.int.test.ts`, `apps/api/src/modules/tenant/test/tenant.router.int.test.ts` y los tests de Express del guard

**Interfaces:**
- Produces:
  - `type ResolvedAccess = AccessGrants & { roleId: string | null; roleVersion: number | null }`
  - `resolveAccess(input: { userId: string; tenantId: string }): Promise<ResolvedAccess | null>` — `null` si no hay membresía, o si el `role_id` no existe o es de otra organización.
  - `OWNER_ACCESS: ResolvedAccess` (`isOwner: true`, sin rol) para el admin de plataforma sin membresía.
  - tRPC `tenant.permissions` (con `protectedProcedure`) → `{ isOwner, grants, version: string }` y `tenant.permissionsVersion` → `{ version: string }`, con `version = "<roleId>:<roleVersion>"` (`"owner:0"` para `OWNER_ACCESS`).
  - Cabecera de respuesta `x-permissions-version` con el mismo valor en toda llamada que pase por `protectedProcedure`.

- [ ] **Step 1: Write failing tests.** `access.int.test.ts`: el mismo usuario con rol distinto en dos organizaciones obtiene grants distintos; editar el rol cambia el resultado en la llamada siguiente (sin caché); miembro con `role_id` de otra organización → `null` y la petición da 403 (review focus 1); grants cuyo recurso o acción no está en el catálogo se ignoran (review focus 4); admin de plataforma miembro usa el rol de su membresía y no genera fila en `platform_access_log`, y sin membresía obtiene `OWNER_ACCESS` con fila auditada (review focus 5). `tenantChain`: `guardedProcedure` permite lo concedido y devuelve `FORBIDDEN` con lo no concedido; la cabecera sale en la respuesta. `tenant.permissions` devuelve la matriz y la versión. Express: la subida de adjuntos decide igual que tRPC (rol sin `payment.upload_attachment` → 403).
- [ ] **Step 2:** Run `pnpm --filter api test:int -- access tenantChain tenant.router guardTenantSession` — Expected: FAIL.
- [ ] **Step 3:** Implementar `resolveAccess` con una sola consulta `member → role → role_permission` filtrada por `tenant_id`, sin valor por defecto. `protectedProcedure` y `guardTenantSession` la llaman tras `evaluateTenantAccess` y comparten la decisión de `can`; el `effectiveUser` con `role: SUPERADMIN` desaparece. Los módulos que reciben `ctx` reciben `access` dentro de `TenantCtx`.
- [ ] **Step 4:** Run los tests del Step 2 y toda la suite `pnpm --filter api test:int` — Expected: PASS (los tests que fijaban `user.role` en el contexto se actualizan para fijar el rol de la membresía con `addMember`). `pnpm check-types` limpio.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 6: Módulo `roles` — repository y service con las reglas de seguridad

**Files:**
- Create: `apps/api/src/modules/roles/{roles.repository,roles.service,roles.resource,roles.module}.ts`
- Modify: `apps/api/src/lib/errors/constants.ts` (grupo `role`: `NOT_FOUND`, `NAME_TAKEN`, `IS_OWNER`, `IN_USE`, `VERSION_CONFLICT: 'ROLE_VERSION_CONFLICT'`, `PRIVILEGE_ESCALATION`, `LAST_OWNER`)
- Create: `packages/schemas/src/roles.ts` y export en `index.ts`
- Test: `apps/api/src/modules/roles/test/roles.service.int.test.ts`, `apps/api/src/modules/roles/test/roles.isolation.int.test.ts`

**Interfaces:**
- Produces (`@repo/schemas`): `createRoleSchema` (`name` 1–60 sin espacios en los bordes, `permissions: { resource, action, scope }[]` validadas con `isCatalogPermission`), `updateRoleSchema` (`id`, `expectedVersion: number`, mismos campos), `roleResource`.
- Produces (API): `rolesModule(ctx: TenantCtx): RolesService` con `list(): Promise<Role[]>`, `get(id)`, `create(input)`, `update(id, input)`, `duplicate(id)`, `delete(id)`. `RolesRepository(db, tenantId)` con `tenantEq` en cada query. Toda mutación escribe `role_audit_log` y `version + 1` en la misma transacción; `update` filtra por `id` **y** `version = expectedVersion`.

- [ ] **Step 1: Write failing tests.** `roles.service`: crear y listar con número de miembros; `update` con versión vieja → `ROLE_VERSION_CONFLICT` y dos `update` concurrentes con la misma versión dejan uno exitoso y otro en conflicto (review focus 2); editar el dueño falla (`IS_OWNER`); borrar el dueño falla; borrar un rol con miembros falla con `IN_USE` e informa cuántos; nombre repetido → `NAME_TAKEN`; escalada: un actor sin `quote.delete` no puede conceder `quote.delete` ni editar su propio rol para ampliarlo; un permiso fuera del catálogo se rechaza en el schema; cada mutación deja su fila de auditoría con antes y después. `roles.isolation`: desde la organización A, `get`/`update`/`delete`/`duplicate` de un rol de B se comportan como inexistentes y nunca alteran sus filas.
- [ ] **Step 2:** Run `pnpm --filter api test:int -- roles.service roles.isolation` — Expected: FAIL.
- [ ] **Step 3:** Implementar siguiendo la receta del repository de `docs/backend/architecture.md` §11.3. La regla de escalada compara los permisos pedidos con `ctx.access` del actor (`can`/`scopeFor`; un `own` no puede ampliarse a `all`). El actor dueño no tiene restricción de escalada.
- [ ] **Step 4:** Run los tests — Expected: PASS; `pnpm check-types` limpio.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 7: Router de `roles` y su registro

**Files:**
- Create: `apps/api/src/modules/roles/roles.router.ts`
- Modify: el `appRouter` donde se registran los demás routers
- Test: `apps/api/src/modules/roles/test/roles.router.int.test.ts`

**Interfaces:**
- Consumes: `rolesModule` (Task 6). Produces: `appRouter.roles.{list,get,create,update,duplicate,delete}`, cada uno con `guardedProcedure({ [RESOURCES.ROLE]: [ACTIONS.READ|CREATE|UPDATE|DELETE] })` (`duplicate` exige `CREATE`).

- [ ] **Step 1: Write failing tests.** Un miembro sin `role.read` recibe `FORBIDDEN` en `list`; el dueño lista, crea, edita, duplica y borra; un rol con `role.update` pero sin `role.create` no puede crear ni duplicar.
- [ ] **Step 2:** Run `pnpm --filter api test:int -- roles.router` — Expected: FAIL.
- [ ] **Step 3:** Implementar el router y registrarlo; el tipo `AppRouter` expone los nuevos procedimientos a la web.
- [ ] **Step 4:** Run el test y `pnpm check-types` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 8: Módulo `users` con rol por membresía

**Files:**
- Modify: `packages/schemas/src/users.ts` (`createUserSchema`/`updateUserSchema`: `role` enum → `roleId: z.string().min(1)`; `usersListQuerySchema.sortBy` conserva `'role'`), `apps/api/src/modules/users/{users.service,users.repository,users.router,users.resource,users.module}.ts`
- Test: ampliar `apps/api/src/modules/users/test/users.isolation.int.test.ts`

**Interfaces:**
- Consumes: `ResolvedAccess` en `TenantCtx` (Task 5).
- Produces: `UsersRepository.addMembership(userId, roleId)`, `updateMemberRole(userId, roleId)`, `countOwners()`; el listado devuelve `role: { id, name, isOwner }` de la membresía y ordena por `role.name`; un llamador que no es dueño no ve miembros con rol dueño (sustituye el filtro `ne(member.role, 'superadmin')`).

- [ ] **Step 1: Write failing tests.** Un admin cambia el rol de una cuenta compartida solo en su organización y la otra membresía no cambia; quitar a una persona con varias membresías elimina solo la de su organización y no borra la cuenta; el `roleId` de otra organización se rechaza como inexistente; cambiar o quitar al último dueño falla con `ROLE_LAST_OWNER` aunque la cuenta tenga otras membresías (review focus 3); un admin sigue sin poder cambiar nombre ni regenerar el enlace de una cuenta compartida (`USER_IN_MULTIPLE_ORGANIZATIONS`) ni de un admin de plataforma; asociar un email existente sigue siendo solo del admin de plataforma; nadie se cambia su propio rol (el router compara `roleId`).
- [ ] **Step 2:** Run `pnpm --filter api test:int -- users.isolation` — Expected: FAIL.
- [ ] **Step 3:** Implementar. `assertManageable` se aplica solo a operaciones globales (`update` del nombre, `regeneratePasswordSetupLink`); el cambio de rol y `remove` no lo exigen. Dejan de escribirse `user.role` y la rama que lo reescribía; `member.role` se escribe con la función única de la Task 4.
- [ ] **Step 4:** Run `pnpm --filter api test:int` completo y `pnpm check-types` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 9: Núcleo de la web — permisos cargados y evaluación

**Files:**
- Create: `apps/web/src/features/tenant/hooks/usePermissions.ts`
- Modify: `apps/web/src/lib/auth/{useCan.ts,Can.tsx,useIsSuperAdmin.ts}`, `apps/web/src/lib/navigation/hooks/useNavigation.ts`, `apps/web/src/features/tenant/components/TenantGate.tsx`, `apps/web/src/lib/trpc/provider.tsx`, `apps/web/src/features/tenant/index.ts`
- Test: `apps/web/src/features/tenant/test/usePermissions.test.ts`, `apps/web/src/lib/auth/test/useCan.test.ts`

**Interfaces:**
- Produces: `usePermissions(): { access: AccessGrants | undefined; version: string | undefined; isPending: boolean }` sobre `tenant.permissions` con `staleTime: 0`; `useCan(): (check: PermissionCheck) => boolean` con la misma firma que hoy; `useIsOwner(): boolean` (sustituye a `useIsSuperAdmin`); `useCanReassignQuote`/`useCanRegeneratePdf` leen del mismo origen.
- Mecanismo de versión: el `httpBatchLink` de `provider.tsx` usa un `fetch` que lee `x-permissions-version` y, si difiere de `version` cargada, invalida `tenant.permissions`; `usePermissions` añade un sondeo con `refetchInterval` de 45 s sobre `tenant.permissionsVersion` y revalida al volver el foco; un 403 por permiso (en `handleError`) invalida los permisos y muestra el aviso "tu rol cambió".

- [ ] **Step 1: Write failing tests.** `useCan`: con grants cargados devuelve `true`/`false` como `can`; con permisos aún no cargados devuelve `false`; el dueño pasa todo. `usePermissions`: un cambio en la versión recibida dispara una nueva petición de `tenant.permissions`; al cambiar de organización se vuelve a pedir. `TenantGate`: no renderiza hijos hasta tener organización **y** permisos.
- [ ] **Step 2:** Run `pnpm --filter web test -- usePermissions useCan` — Expected: FAIL.
- [ ] **Step 3:** Implementar, y migrar los usos de `useSession().user.role` para autorizar a `usePermissions`. i18n es/en para el aviso de rol cambiado.
- [ ] **Step 4:** Run `pnpm --filter web test` y `pnpm --filter web check-types` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear. Pruebas manuales que corre el usuario: cambiar de organización con dos pestañas abiertas y editar un rol con otra persona conectada.

### Task 10: Guard de rutas dentro de `TenantGate` y middleware reducido

**Files:**
- Create: `apps/web/src/lib/auth/RouteGuard.tsx`
- Modify: `apps/web/src/middleware.ts` (conserva sesión y `mustChangePassword`; se elimina `hasPermission`), `apps/web/src/features/tenant/components/TenantGate.tsx` (monta `RouteGuard`), `apps/web/src/lib/auth/route-access.ts` (se conserva `resolveRouteAccess`)
- Test: `apps/web/src/lib/auth/test/routeGuard.test.tsx`; el `route-access.test.ts` existente sigue en verde

**Interfaces:**
- Produces: `RouteGuard({ children })` evalúa `resolveRouteAccess(pathname)` con `useCan` y: permitido → hijos; sin permiso en `DEFAULT_REDIRECT_HOME` → ruta `WELCOME_ROUTE`; sin permiso en otra ruta → `DENIED_ROUTE` (mismo criterio que hoy en el middleware).

- [ ] **Step 1: Write failing tests.** Ruta con guard sin permiso → muestra la pantalla de acceso denegado; en el inicio sin permiso → bienvenida; ruta sin guard → hijos; mientras los permisos cargan no redirige.
- [ ] **Step 2:** Run `pnpm --filter web test -- routeGuard` — Expected: FAIL.
- [ ] **Step 3:** Implementar y reducir el middleware.
- [ ] **Step 4:** Run `pnpm --filter web test` y `pnpm --filter web check-types` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 11: Feature `roles` en la web (editor)

**Files:**
- Create: `apps/web/src/features/roles/**` siguiendo `docs/frontend/architecture.md` §3 (`types.ts`, `hooks/useRoles.ts`, `hooks/useRoleRowActions.ts`, `components/{RolesPage,RolesTable,RoleCard,RoleForm,PermissionMatrix}.tsx`, barrel), rutas `app/(admin)/…/roles` thin, entrada de navegación con guard `{ [RESOURCES.ROLE]: [ACTIONS.READ] }`, textos en `locales/{es,en}`
- Test: `apps/web/src/features/roles/test/RoleForm.test.tsx`, `apps/web/src/features/roles/test/PermissionMatrix.test.tsx`

**Interfaces:**
- Consumes: `trpc.roles.*` (Task 7), `catalogResources`/`catalogActions`/`scopeFor` y `usePermissions` (Tasks 1 y 9).
- Produces: `PermissionMatrix({ value, onChange, actorAccess, locked })` — recursos agrupados desde el catálogo (acordeón en móvil), selector `own/all` donde el catálogo lo permite, casillas deshabilitadas para permisos que el actor no tiene, todo marcado y bloqueado cuando el rol es dueño.

- [ ] **Step 1: Write failing tests.** `PermissionMatrix`: pinta un recurso nuevo del catálogo sin tocar el componente; deshabilita lo que el actor no tiene; el rol dueño aparece bloqueado. `RoleForm`: envía `expectedVersion`; ante `ROLE_VERSION_CONFLICT` conserva lo escrito y ofrece recargar; borrar un rol con miembros muestra cuántos hay.
- [ ] **Step 2:** Run `pnpm --filter web test -- features/roles` — Expected: FAIL.
- [ ] **Step 3:** Implementar mobile-first (card en móvil, `DataTable` desde `md`), acciones por fila bajo `<Can>`, `lucide-react`, sin `uppercase`.
- [ ] **Step 4:** Run `pnpm --filter web test` y `pnpm --filter web check-types` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear. Pruebas manuales que corre el usuario: el editor en móvil y en escritorio, y un conflicto de versión con dos pestañas.

### Task 12: Usuarios, `RoleTag` y ajustes sobre roles de la organización

**Files:**
- Modify: `apps/web/src/features/users/components/{UserForm,EditUserModal,CreateUserModal,UserCard,columns}.tsx`, `apps/web/src/features/users/types.ts`, `apps/web/src/components/shared/RoleTag.tsx`, `apps/web/src/features/settings/components/PermissionsMatrixCard.tsx`
- Test: ampliar los tests existentes de `features/users` o crear `features/users/test/UserForm.test.tsx`

**Interfaces:**
- Consumes: `trpc.roles.list` y `role: { id, name, isOwner }` del listado de usuarios (Task 8).
- Produces: el selector de rol de `UserForm` muestra los roles de la organización y envía `roleId`; `RoleTag` recibe `{ name, isOwner }`; `PermissionsMatrixCard` muestra la matriz efectiva de quien la mira desde `usePermissions` y deja de importar `ROLES`.

- [ ] **Step 1: Write failing tests.** `UserForm` ofrece los roles de la organización y no los 4 fijos; envía `roleId`; un actor sin `role.read` sigue pudiendo asignar solo los roles que `trpc.roles.list` le devuelva.
- [ ] **Step 2:** Run `pnpm --filter web test -- features/users` — Expected: FAIL.
- [ ] **Step 3:** Implementar; textos es/en.
- [ ] **Step 4:** Run `pnpm --filter web test` y `pnpm check-types` — Expected: PASS.
- [ ] **Checkpoint:** cambios sin commitear.

### Task 13: Retirada de lo viejo y documentación

**Files:**
- Modify: `packages/guards/src/core/access-control.ts` (eliminar `hasPermission` y `resolveResourceScope`; `ac` y `roles` se conservan solo para el plugin `admin` de Better Auth), `apps/api/src/lib/auth.ts` (el plugin `admin` deja de depender de la matriz para autorizar), `docs/backend/architecture.md` (§7 y §11.1, §11.6), `docs/frontend/architecture.md` (§9.2 y §9.3), `docs/superpowers/handoffs/` (nota de cierre de fase si el usuario lo pide)
- Test: suites completas

- [ ] **Step 1:** Run `pnpm check-types` tras eliminar `hasPermission` y `resolveResourceScope` — Expected: cualquier uso restante falla la compilación y se migra a `can`/`scopeFor`.
- [ ] **Step 2:** Verificar que nada lee `user.role` ni `member.role` para autorizar; dejar de escribir `user.role` donde aún se escribe y registrar la eliminación de ambas columnas como paso posterior (fuera de esta fase).
- [ ] **Step 3:** Actualizar la documentación: autorización por membresía, `ctx.access`, `x-permissions-version`, guard cliente, regla de que un permiso nuevo del catálogo aparece solo en el editor y de que la plantilla de roles base está en `ROLE_TEMPLATES`.
- [ ] **Step 4:** Run `pnpm test`, `pnpm --filter api test:int`, `pnpm check-types` — Expected: todo en verde.
- [ ] **Checkpoint:** cambios sin commitear. Checklist manual para el usuario: cambio de rol con dos pestañas abiertas, rol editado mientras otra persona lo usa, editor en móvil, `pnpm --filter api mt:verify` sobre una base con varias organizaciones.
