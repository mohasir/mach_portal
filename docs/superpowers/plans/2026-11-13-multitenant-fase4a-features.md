# Multi-tenant fase 4a: módulos y add-ons por organización — plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** controlar por organización qué módulos y add-ons tiene activos (con vigencia y precio pactado), y generalizar el catálogo con `products.price` por unidad, de modo que los tiers sean un add-on.

**Arquitectura:** catálogo de features en `@repo/guards/features` (única fuente de qué existe); estado por organización en `tenant_features` (RLS de solo lectura para `app`, escritura con el rol `platform`) más historial en `tenant_feature_events`; la API resuelve las features por petición con caché en memoria y las aplica en `guardedProcedure` (módulos) y `requireFeature` (add-ons); la web las lee con `features.mine`.

**Stack:** pnpm/Turborepo, Drizzle + Postgres (RLS), tRPC v11, Vitest, Next 15 + AntD v6 + Tailwind v4, i18next.

**Spec:** `docs/superpowers/specs/2026-11-13-multitenant-fase4a-features-design.md`. Leer también `docs/backend/architecture.md` (§11 multi-tenant, §12 RLS) y `docs/frontend/architecture.md` antes de tocar API o web.

## Restricciones globales

- Comentarios de código en inglés y solo cuando explican un *porqué* no obvio; nada que dependa de la conversación.
- Backend: `resource → repository → service → router`, `AppError`/`ErrorCodes`, repositories con `(db, tenantId)` y `tenantEq`. Esquema: cambiar el TS → `db:generate` → revisar el SQL → `db:migrate` (nunca `db:push`). Añadir a mano `FORCE ROW LEVEL SECURITY` en la migración.
- Web: mobile-first, AntD v6 + Tailwind, `lucide-react`, sin inline styles ni hex, sin `uppercase`, textos en i18n es/en, fechas con `useDateFormatter`.
- **Prohibido** ejecutar `db:migrate`, `db:roles`, `db:fresh`, `db:reset`, `db:seed` ni `feature:*` contra una base real, levantar servidores o abrir el navegador. Las pruebas de integración usan `TEST_DATABASE_URL` (solo local) con la contraseña en línea, sin escribirla en archivos.
- Nunca leer `.env`. **No hacer commit, push ni PR sin OK explícito del usuario**: cada tarea deja los cambios en staged y se detiene para revisión. Sin líneas de atribución en commits.
- Claves de features (provisionales, se fijan en la tarea 1): `auth users roles settings clients catalog dashboard support` (core), `quotes events notifications` (module), `priceTiers configurableOptions` (addon). `events` requiere `quotes`.
- Una feature está activa si `enabled`, `expires_at` es `NULL` o posterior a ahora, y todas sus dependencias están activas. `--expires` es el último día activo (se guarda el inicio del día siguiente, UTC).
- Caché de features: en memoria, por organización, TTL 30 s, falla cerrado (solo núcleo).
- Verificación por tarea: `pnpm --filter <paquete> check-types`, `pnpm --filter <paquete> test` y, en la API, `pnpm --filter api test:int` de la zona tocada.

## Enfoque de pruebas y foco de revisión

**Foco de revisión** (casos que el spec implica y las pruebas de cada tarea deben cubrir):

1. `quotes` vencida o desactivada con `events` activo: `events` queda inactivo (dependencia), y la CLI rechaza desactivar `quotes` mientras `events` esté activo. *(T1, T3)*
2. Caché: clave por organización (sin fuga entre organizaciones), TTL, y fallo de lectura ⇒ solo núcleo. *(T4)*
3. Producto con tiers, sin `price` y con `priceTiers` apagado: `PRODUCT_NOT_QUOTABLE` en líneas nuevas, pero las cotizaciones existentes se abren y aceptan. *(T5)*
4. El rol `app` no puede insertar, actualizar ni borrar en `tenant_features` (ni en su propia organización) y no ve `tenant_feature_events`. *(T2)*
5. Frontera de vigencia: `expires_at` igual a "ahora" es inactiva; `feature:set` sobre una `core` o una clave desconocida falla; `feature:unset` conserva precio y fechas. *(T1, T3)*

**Fixtures:** los tests de integración existentes de cotizaciones, eventos, pagos, personal y notificaciones asumen todo activo. `createTestTenant` y `seedTwoTenants` (`apps/api/src/test/db.ts`) activan todas las features por defecto, con opción `features` para limitarlas.

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/guards/src/features/{registry,resolve,resourceModules,index}.ts` | Catálogo, `resolveFeatures`, mapeo recurso→módulo |
| `packages/schemas/src/features.ts` | `featureKeySchema` (`z.enum` derivado del catálogo), esquema de `features.mine` |
| `apps/api/src/db/schema/features.ts` | Tablas `tenant_features`, `tenant_feature_events` |
| `apps/api/src/db/rls/policy.ts` | Nuevo `tenantReadPolicy(table)` (solo `SELECT`) |
| `apps/api/drizzle/0006_*.sql` | Migración con RLS, FORCE y relleno |
| `apps/api/src/lib/features/{repository,cache,admin}.ts` | Lectura por organización, caché, servicio de administración (rol `platform`) |
| `apps/api/src/db/scripts/feature.ts` | CLI `feature:list/set/unset` |
| `apps/api/src/modules/features/{features.router,features.service}.ts` | `features.mine` |
| `apps/web/src/features/tenant/hooks/useFeatures.ts`, `apps/web/src/lib/auth/{useFeature.ts,Feature.tsx}` | Lectura y componente |
| `apps/web/src/components/shared/ModuleUnavailable.tsx` | Estado "módulo no disponible" |

---

### Task 1: Catálogo de features en `@repo/guards`

**Archivos:**
- Crear: `packages/guards/src/features/registry.ts`, `resolve.ts`, `resourceModules.ts`, `index.ts`; modificar `packages/guards/src/index.ts` (exportar `./features/index`).
- Crear: `packages/schemas/src/features.ts` (+ export en `index.ts`).
- Pruebas: `packages/guards/src/features/test/{registry,resolve,resourceModules}.test.ts`.

**Interfaces:**
- Produce: `FEATURES` (clave → `{ kind: 'core'|'module'|'addon'; requires: readonly FeatureKey[] }`), `type FeatureKey`, `FEATURE_KEYS`, `isFeatureKey(v): v is FeatureKey`, `isToggleable(key): boolean` (no `core`).
- Produce: `type FeatureRow = { featureKey: string; enabled: boolean; expiresAt: Date | null }`; `resolveFeatures(rows: readonly FeatureRow[], now: Date): ReadonlySet<FeatureKey>` (incluye siempre las `core`; ignora claves desconocidas).
- Produce: `RESOURCE_MODULE: Partial<Record<ResourceType, FeatureKey>>` y `moduleOfResource(resource: string): FeatureKey | undefined`. Mapeo: `quote, pipeline, quote_defaults, quote_stages, quote_pdf_template, quote_builder_preferences, pipeline_preferences → quotes`; `event, payment, staff, event_type, reschedule_reason → events`. El resto (incluidos `product`, `price_tiers`, `product_option`, `tax_rates`, `catalog_preferences`) no tiene módulo.
- Produce (schemas): `featureKeySchema = z.enum(FEATURE_KEYS)`.

- [ ] **Paso 1: pruebas que fallan.** `registry.test.ts`: toda `core` tiene `requires` vacío o solo `core`; ninguna dependencia apunta a una clave inexistente; no hay ciclos; `events.requires` es `['quotes']`. `resolve.test.ts`: núcleo siempre activo con `rows = []`; `enabled=false` inactiva; `expiresAt == now` inactiva y `now+1ms` activa; `events` con `quotes` vencida queda inactiva; clave desconocida ignorada. `resourceModules.test.ts`: cada `ResourceType` mapeado existe en `RESOURCES`; `moduleOfResource('product')` es `undefined`.
- [ ] **Paso 2:** ejecutar `pnpm --filter @repo/guards test` y comprobar que fallan.
- [ ] **Paso 3:** implementar según las interfaces. `resolve` evalúa dependencias en orden topológico (o iterando hasta punto fijo).
- [ ] **Paso 4:** `pnpm --filter @repo/guards test` y `check-types` de `guards` y `schemas` en verde.
- [ ] **Paso 5:** dejar en staged (`git add`) y detenerse para revisión; **no commitear**.

### Task 2: Esquema, RLS, migración `0006` y `products.price`

**Archivos:**
- Crear: `apps/api/src/db/schema/features.ts`; modificar `schema/index.ts`, `schema/catalog.ts` (`price: integer('price')` nullable en `products`), `schema/tenantColumn.ts`, `db/rls/policy.ts`.
- Generar: `apps/api/drizzle/0006_*.sql` + `meta/` con `db:generate`; editar el SQL a mano (FORCE y relleno).
- Modificar: `db/scripts/verifyMultitenant.ts` (excluir las dos tablas de `TENANT_TABLES` y añadir su comprobación específica: RLS habilitado y forzado, una sola política `SELECT` en `tenant_features`, ninguna en `tenant_feature_events`).
- Pruebas: `db/rls/test/features.rls.int.test.ts`, ajustes en `db/rls/test/rlsMigration.int.test.ts` y `db/schema/test/tenantTables.test.ts`.

**Interfaces:**
- Produce: `tenantFeatures` (PK `tenant_id + feature_key`; `enabled boolean default true`, `activatedAt`, `expiresAt` nullable, `priceCents integer` nullable, `billingPeriod text` nullable, `currency text` nullable, `updatedAt`), `tenantFeatureEvents` (`id uuid`, `tenantId`, `featureKey`, `action text enum('enabled','disabled','updated')`, `before jsonb`, `after jsonb`, `actor text`, `createdAt`).
- Produce: `tenantReadPolicy(table: string)` en `policy.ts` (`FOR SELECT TO public USING tenant_id = current_setting('app.tenant_id', true)`).
- Ambas tablas añadidas a `TENANT_EXEMPT_TABLES` solo si `tenantTables.test.ts` lo exige; ambas conservan FK de `tenant_id` a `organization.id`.

- [ ] **Paso 1: pruebas que fallan** (`features.rls.int.test.ts`, conexiones `app`/`platform` como en `rls.int.test.ts`): `app` con el tenant A fijado lee solo sus filas de `tenant_features`; el `INSERT`, `UPDATE` y `DELETE` de `app` en su propia organización falla con violación de RLS; `app` no ve filas de `tenant_feature_events` y no puede insertar; `platform` ve y escribe ambas. En `rlsMigration.int.test.ts`: las dos tablas tienen RLS habilitado y forzado en la base construida con las migraciones reales.
- [ ] **Paso 2:** definir esquema y `tenantReadPolicy`; `pnpm --filter api db:generate`; revisar el SQL; añadir `FORCE ROW LEVEL SECURITY` para ambas tablas y el relleno:
  `INSERT INTO tenant_features (tenant_id, feature_key) SELECT o.id, k FROM organization o CROSS JOIN unnest(ARRAY['quotes','events','notifications','priceTiers','configurableOptions']) k`.
- [ ] **Paso 3:** ajustar `verifyMultitenant.ts` y las pruebas de enumeración de tablas; documentar en el helper de `test/rlsPolicies.ts` si `completePushedPolicies` necesita tratar la política `SELECT`.
- [ ] **Paso 4:** `pnpm --filter api test`, `test:int` (zonas `db/rls` y `db/schema`) y `check-types` en verde. No ejecutar `db:migrate` contra una base real.
- [ ] **Paso 5:** staged y detenerse para revisión.

### Task 3: Servicio de administración, CLI y seed de demo

**Archivos:**
- Crear: `apps/api/src/lib/features/admin.ts`, `apps/api/src/db/scripts/feature.ts`; modificar `apps/api/package.json` (`feature:list|set|unset`), `lib/errors/constants.ts` (`feature: { NOT_ENABLED, UNKNOWN_KEY, NOT_TOGGLEABLE, MISSING_DEPENDENCY, HAS_DEPENDENTS }`), `db/seeds/demo.ts` (activa todas las features), `db/scripts/verifyMultitenant.ts` (dos comprobaciones: ninguna fila `core` o desconocida; ninguna organización con `events` activo sin `quotes` activo).
- Pruebas: `lib/features/test/admin.int.test.ts`, `db/scripts/test/feature.test.ts`.

**Interfaces:**
- Consume: `FEATURES`, `resolveFeatures`, `isFeatureKey`, `isToggleable` (T1); tablas (T2); `platformDb()`.
- Produce: `setFeature(db: Database, input: { tenantSlug: string; key: string; expiresAt?: Date | null; priceCents?: number | null; billingPeriod?: string | null; currency?: string | null; actor: string }): Promise<FeatureRow>`; `unsetFeature(db, { tenantSlug, key, actor })`; `listFeatures(db, tenantSlug): Promise<Array<FeatureRow & { active: boolean; kind: string }>>`. Todos corren en una transacción y registran un `tenant_feature_events`.
- Produce: `parseFeatureArgs(argv): { command; tenantSlug; key?; expires?; price?; period?; currency? }` (exportada para probarla) y `parseExpiryDate(yyyyMmDd): Date` (inicio del día siguiente, UTC).

- [ ] **Paso 1: pruebas que fallan.** Servicio: clave desconocida ⇒ `UNKNOWN_KEY`; `core` ⇒ `NOT_TOGGLEABLE`; `events` sin `quotes` activo ⇒ `MISSING_DEPENDENCY`; `unsetFeature('quotes')` con `events` activo ⇒ `HAS_DEPENDENTS` nombrando `events`; `unset` deja `enabled=false` y conserva precio y fechas; `set` sobre una fila existente registra `updated` con antes y después; slug inexistente falla; el actor queda en el historial. CLI: `parseExpiryDate('2027-06-30')` es `2027-07-01T00:00:00Z`; argumentos faltantes o inválidos devuelven un mensaje claro.
- [ ] **Paso 2:** implementar servicio, CLI (usa `requireDatabaseUrl('DATABASE_PLATFORM_URL')` vía `platformDb()`, cierra con `closePlatformDb()`, actor = `os.userInfo().username`) y scripts de `package.json`; activar todo en el seed de demo.
- [ ] **Paso 3:** verde de `test`, `test:int` de `lib/features` y `check-types`. No ejecutar los `feature:*` contra una base real.
- [ ] **Paso 4:** staged y detenerse.

### Task 4: Contexto, caché, guards y `features.mine`

**Archivos:**
- Crear: `lib/features/{repository,cache}.ts`, `core/trpc/requireFeature.ts`, `modules/features/{features.service,features.router}.ts`, `packages/schemas/src/features.ts` (esquema de salida).
- Modificar: `core/trpc/trpc.ts` (`ctx.features`; check de módulo en `guardedProcedure`, `guardedShortTxProcedure` y `guardedProcedureAnyOf`), `core/trpc/tenantCtx.ts`, `core/trpc/router.ts`, routers `products` (grupos y opciones ⇒ `configurableOptions`; `prices.update` ⇒ `priceTiers`) y `notifications` (⇒ `notifications`); `modules/config` (ignorar los ajustes de opciones sin `configurableOptions`); `apps/api/src/test/db.ts` (activar todo por defecto, opción `features`) y `test/trpcCaller.ts`.
- Pruebas: `lib/features/test/cache.test.ts`, `modules/features/test/features.int.test.ts`, `core/trpc/test/featureGuards.int.test.ts`, además de la corrida completa de `test:int`.

**Interfaces:**
- Consume: `resolveFeatures`, `moduleOfResource` (T1); `tenantFeatures` (T2); `AppError`, `ErrorCodes.feature.NOT_ENABLED` (T3).
- Produce: `loadTenantFeatures(tenantId: string, executor: Executor): Promise<FeatureRow[]>`; `getTenantFeatures(tenantId, load: () => Promise<FeatureRow[]>, now?: Date): Promise<ReadonlySet<FeatureKey>>` (caché TTL 30 s por `tenantId`; si `load` lanza, devuelve solo el núcleo y **no** cachea el fallo); `clearFeatureCache(tenantId?: string): void`.
- Produce: `ctx.features: ReadonlySet<FeatureKey>` en la cadena protegida; `requireFeature(key: FeatureKey)` (middleware que lanza `TRPCError FORBIDDEN` con `AppError(ErrorCodes.feature.NOT_ENABLED, undefined, 403, { feature: key })` solo en `mutation`); `features.mine` (query `protectedProcedure`, sin permiso de rol) que devuelve `{ features: Array<{ key: FeatureKey; expiresAt: string | null }> }` solo de las activas no-core más las core.
- Regla de módulo: en `guardedProcedure` y variantes, si algún recurso del `PermissionCheck` pertenece a un módulo inactivo y el tipo es `mutation`, lanza `FEATURE_NOT_ENABLED`. Las consultas pasan.

- [ ] **Paso 1: pruebas que fallan.** Caché: segunda lectura dentro del TTL no recarga; pasado el TTL sí; claves distintas por organización; `load` que falla ⇒ solo núcleo y la siguiente llamada reintenta. Guards: con `quotes` apagado, `quotes.create` falla con `FEATURE_NOT_ENABLED` y `quotes.list` responde; `events` activo pero `quotes` vencida ⇒ mutaciones de eventos bloqueadas; con `priceTiers` apagado `products.prices.update` falla y la consulta funciona; con `configurableOptions` apagado fallan las mutaciones de grupos y opciones; `features.mine` devuelve solo lo activo de la organización del llamador; `ctx.features` se resuelve con la transacción de la petición (sin segunda conexión) y en `shortTxProcedure` con `runInTenant`.
- [ ] **Paso 2:** implementar. En `protectedProcedure`, cargar con la `tx` de la petición; en `shortTxProcedure`, con `ctx.runInTenant`. Mantener el orden: `ctx.features` se resuelve después de `admit`.
- [ ] **Paso 3:** actualizar `createTestTenant`/`seedTwoTenants` (insertan 5 filas permanentes con `testDb`, que es el rol de pruebas con `BYPASSRLS`) y llamar a `clearFeatureCache()` en el `setup` de integración.
- [ ] **Paso 4:** `pnpm --filter api test`, **`test:int` completo** (los tests existentes deben seguir en verde por el fixture) y `check-types`.
- [ ] **Paso 5:** staged y detenerse.

### Task 5: Dominio — precio fijo y producto no cotizable

**Archivos:**
- Modificar: `packages/schemas/src/catalog.ts` (`price` opcional y nullable en crear/actualizar producto, entero ≥ 0), `modules/products/{products.resource,products.repository,products.service}.ts` (columnas públicas, `price`, y `quotable: boolean` calculado en el árbol), `modules/quotes/{quotes.repository,quotes.service}.ts` (`CatalogContext` incluye `price` y `priceTiersActive`; `validateLine`), `lib/errors/constants.ts` (`product.NOT_QUOTABLE: 'PRODUCT_NOT_QUOTABLE'`), `db/seeds/catalog.ts` (precio fijo para los productos de demo que lo necesiten).
- Pruebas: `modules/products/test/*`, `modules/quotes/test/*` (unitarias e integración).

**Interfaces:**
- Consume: `ctx.features` (T4), `products.price` (T2).
- Produce: regla `isQuotable(product, tiers, priceTiersActive)` = `price != null || (priceTiersActive && tiers.length > 0)`; `validateLine` (usuarios sin `MANAGE_LINE_PRICING`): válida si coincide con un tier (solo con `priceTiersActive`) o `subtotal === price * numPersons`; producto no cotizable ⇒ `PRODUCT_NOT_QUOTABLE` (también para quien gestiona precios).
- `validateLines` recibe el conjunto de features activas desde el servicio de cotizaciones (`ctx.features`).

- [ ] **Paso 1: pruebas que fallan.** Sin `priceTiers`, producto con `price=5` y 40 personas: subtotal 200 válido, 199 inválido (`PRICING_NOT_ALLOWED`); sin `price` ⇒ `PRODUCT_NOT_QUOTABLE`; con `priceTiers` activo y tiers, el tier sigue siendo válido; con `priceTiers` activo, tiers y `price`, ambos caminos valen; con `priceTiers` apagado un tier ya no vale aunque exista; una cotización existente con líneas de tier se lee y se acepta con `priceTiers` apagado (no se revalida); `products.catalog` marca `quotable`.
- [ ] **Paso 2:** implementar; el árbol del catálogo sigue devolviendo los tiers guardados aunque el add-on esté apagado.
- [ ] **Paso 3:** verde de `test`, `test:int` de `products` y `quotes`, y `check-types`.
- [ ] **Paso 4:** staged y detenerse.

### Task 6: Web — consulta, hooks, navegación y "módulo no disponible"

**Archivos:**
- Crear: `apps/web/src/features/tenant/hooks/useFeatures.ts`, `apps/web/src/lib/auth/{useFeature.ts,Feature.tsx}`, `apps/web/src/components/shared/ModuleUnavailable.tsx`.
- Modificar: `lib/navigation/types.ts` (`feature?: FeatureKey`), `lib/navigation/constants/items.ts` (`quotes`: `QUOTES_ITEM`, `PIPELINE_ITEM`; `events`: `CALENDAR_ITEM`, `EVENTS_ITEM`, `PAYMENTS_ITEM`, `STAFF_ITEM`, `EVENT_TYPES_ITEM`, `RESCHEDULE_REASONS_ITEM`), `lib/navigation/hooks/useNavigation.ts`, `lib/auth/{route-access,routeGuardOutcome,RouteGuard}.ts(x)`, el menú de notificaciones del topbar (`notifications`), `apps/web/src/lib/error/` (textos `FEATURE_NOT_ENABLED`, `PRODUCT_NOT_QUOTABLE`) y los archivos de `apps/web/src/locales/{es,en}/`.
- Pruebas: `lib/auth/test/{useFeature,routeGuard,route-access}.test.ts`, test del filtrado de `useNavigation`.

**Interfaces:**
- Consume: `features.mine` (T4), `FEATURES` y `FeatureKey` (T1).
- Produce: `useFeatures(): { keys: ReadonlySet<FeatureKey>; isPending: boolean }` (query con `organizationScopedKey`, `staleTime` 30 s, refetch al enfocar); `useFeature(key: FeatureKey): boolean` (core ⇒ `true`; no-core ⇒ `false` mientras carga); `<Feature name fallback>`; `resolveRouteFeature(pathname): FeatureKey | undefined`; `resolveGuardOutcome` admite `'unavailable'` además de `'allow' | 'wait' | { redirect }` y espera (`'wait'`) hasta que carguen permisos **y** features.
- `RouteGuard` renderiza `<ModuleUnavailable />` cuando el resultado es `'unavailable'`.

- [ ] **Paso 1: pruebas que fallan.** `useFeature` (core true, no-core false al cargar y según la respuesta); `resolveGuardOutcome` devuelve `'unavailable'` para `/admin/quotes` sin `quotes`, `'wait'` mientras cargan las features y `'allow'` con la feature activa; `/admin/events/123/reschedule` hereda la feature `events`; la navegación oculta los ítems de módulos apagados.
- [ ] **Paso 2:** implementar; `ModuleUnavailable` primero para móvil (mensaje i18n "módulo no disponible, contacta a tu administrador" y acción de volver al inicio), con componentes AntD y clases Tailwind.
- [ ] **Paso 3:** `pnpm --filter web test` y `check-types` en verde. No levantar el servidor: dejar al usuario una lista de qué probar.
- [ ] **Paso 4:** staged y detenerse.

### Task 7: Web — catálogo, cotizador y configuración

**Archivos:**
- Modificar: `features/catalog/components/{ProductForm,ProductFormModal,ProductPanel,ProductDetailPage,OptionGroupPanel}.tsx` y `prices/PriceTiersForm.tsx`; `features/catalog/types.ts`; en `features/quotes` el constructor de cotizaciones (selector de tier, cálculo de subtotal por unidad, productos no cotizables deshabilitados con su razón); `features/settings/components/forms/*` (ajustes de opciones); `apps/web/src/locales/{es,en}/` de `catalog`, `quotes` y `settings`.
- Pruebas: pruebas de componentes de las pantallas modificadas con el patrón existente de cada feature.

**Interfaces:**
- Consume: `useFeature`, `<Feature>` (T6), `quotable` y `price` del catálogo (T5).
- Reglas: el campo de precio fijo siempre aparece; las pestañas/paneles de tiers solo con `priceTiers` y los de grupos y opciones solo con `configurableOptions`; un producto con `quotable = false` muestra la etiqueta "No cotizable" y un aviso para fijar el precio; en el cotizador, sin `priceTiers` la línea calcula `price × cantidad` y el selector de tier no aparece; las cotizaciones existentes se muestran igual; sin `configurableOptions` se ocultan `allowSelectOptionsAtQuote` y `optionsSelectionDeadlineDays`.

- [ ] **Paso 1: pruebas que fallan** para cada regla anterior (render condicional por feature, etiqueta "No cotizable", cálculo por unidad).
- [ ] **Paso 2:** implementar mobile-first siguiendo `docs/frontend/architecture.md` y `docs/frontend/styling-guide.md`.
- [ ] **Paso 3:** `pnpm --filter web test` y `check-types`; listar al usuario los casos a probar a mano (organización con y sin cada add-on).
- [ ] **Paso 4:** staged y detenerse.

### Task 8: Documentación

**Archivos:**
- Modificar: `docs/backend/architecture.md` (nueva sección: features, caché, guards, scripts, RLS de solo lectura), `docs/frontend/architecture.md` (`useFeature`, `<Feature>`, `feature` en la navegación, `ModuleUnavailable`), `docs/superpowers/runbooks/multitenant-cutover.md` (relleno de la migración `0006` y cómo activar features en una organización nueva con `feature:set`).

- [ ] **Paso 1:** escribir las secciones; comprobar que los nombres coinciden con los implementados (`grep` de cada símbolo citado).
- [ ] **Paso 2:** staged y detenerse. Al final: revisión de toda la rama con la corrida completa (`pnpm check-types`, `pnpm test`, `pnpm --filter api test:int`).
