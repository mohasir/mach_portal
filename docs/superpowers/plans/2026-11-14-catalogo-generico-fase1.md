# Catálogo genérico, fase 1: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** que el catálogo sirva a cualquier negocio: tipo de catálogo (productos o servicios) por organización, unidades de medida, categorías, campos nuevos del producto, galería de imágenes y fin del rastro del cliente original ("estaciones").

**Arquitectura:** tabla `tenant_profile` (solo la plataforma escribe) con un registro de tipos de catálogo y un hook de vocabulario en la web; módulos completos de unidades y categorías (`resource → repository → service → router`, como `eventTypes`); `product_images` con subida Express y `sharp`; renombrado mecánico `numPersons → quantity` como primera tarea.

**Stack:** pnpm/Turborepo, Drizzle + Postgres (RLS), tRPC v11, Express, Vitest, Next 15 + AntD v6 + Tailwind v4, i18next, `sharp`.

**Spec:** `docs/superpowers/specs/2026-11-14-catalogo-generico-fase1-design.md` (autoridad), y el programa `docs/superpowers/specs/2026-11-14-catalogo-generico-programa.md`. Leer también `docs/backend/architecture.md` (§3, §5, §11, §12, §13) y `docs/frontend/architecture.md` antes de tocar API o web.

## Restricciones globales

- Comentarios en inglés, solo cuando explican un *porqué* no obvio; nada que dependa de la conversación. **Ningún texto, nombre de variable, clave i18n ni dato nuevo debe decir "estación"/"station"** (el objetivo de la fase es quitar ese rastro).
- Backend: `resource → repository → service → router`, `AppError`/`ErrorCodes`, repositories `(db, tenantId)` con `tenantEq`, `guardedProcedure` + `@repo/guards`. Esquema: cambiar el TS → `db:generate` → revisar el SQL → hand-edit. Tablas con `tenant_id`: política `tenantIsolationPolicy`, `.enableRLS()` y `FORCE ROW LEVEL SECURITY` a mano en la migración. Números de migración consecutivos desde `0007`.
- Web: mobile-first, AntD v6 + Tailwind v4, `lucide-react`, sin inline styles ni hex ni `uppercase`, textos i18n es/en con claves paralelas, fechas con `useDateFormatter`. Lógica de decisión en helpers puros con tests (vitest corre en node, solo `*.test.ts`). Prettier solo sobre los archivos tocados, con lista explícita desde la raíz.
- **Prohibido** ejecutar `db:migrate`, `db:roles`, `db:fresh`, `db:reset`, `db:seed`, `feature:*`, `tenant:*` contra una base real, levantar servidores o abrir el navegador. Las pruebas de integración usan una base local `mach_test_*` (contraseña inline en el comando, tomada de `docker-compose.yaml`, nunca escrita en archivos). Nunca leer `.env`.
- **Sin commit, push ni PR sin OK explícito del usuario**: cada tarea deja sus archivos en staged (explícitos, nunca `git add -A`) y se detiene para revisión. Sin atribución de Claude en commits.
- Dinero en centavos; cantidades enteras; factores de unidad en `numeric(24,10)`.
- Verificación por tarea: `pnpm --filter <paquete> check-types`, `test` y, en la API, `pnpm --filter api test:int` de la zona tocada. La última tarea corre todo de punta a punta.

## Foco de revisión

1. **Renombrado completo y sin cambio de comportamiento:** ningún `numPersons`/`num_persons` queda en código, tests, seeds ni docs vigentes (salvo migraciones históricas); el snapshot de drizzle coincide con el esquema (`db:generate` no propone cambios); el payload de PDF sigue igual. *(T1)*
2. **El costo nunca se filtra:** ausente de toda respuesta (lista, catálogo, árbol, duplicar, cotización, evento, PDF) sin el permiso `product_cost`, y escribirlo sin permiso falla. *(T4)*
3. **Máximo de 5 imágenes bajo subidas simultáneas, una sola destacada y R2 limpio:** si falla la fase 3 o se borra, los archivos de R2 desaparecen; una promoción correcta al borrar la destacada. *(T5)*
4. **Unidades:** reglas de `is_system` y de unidades en uso, una base por dimensión, factores exactos, igualdad entre el SQL de la migración y `SYSTEM_UNITS`, productos existentes con "Persona", y formato "0/1/N + plural" correcto en es y en. *(T3)*
5. **Cantidad mínima y aislamiento:** la migración copia `min_persons_per_line` a cada producto antes de eliminar la columna; las cotizaciones ya creadas no se revalidan; `tenant_profile` no se puede escribir con el rol `app` ni leer entre organizaciones. *(T2, T4)*

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/schemas/src/catalogKinds.ts` | `CATALOG_KINDS`, `catalogKindSchema`, `DEFAULT_CATALOG_KIND` |
| `packages/schemas/src/unitsOfMeasure.ts` | Esquemas de unidades, `UOM_DIMENSIONS`, `SYSTEM_UNITS` |
| `packages/schemas/src/productCategories.ts`, `productImages.ts` | Esquemas, `PRODUCT_IMAGES_MAX = 5`, tipos MIME permitidos |
| `apps/api/src/db/schema/{tenantProfile,unitsOfMeasure,productCategories,productImages}.ts` | Tablas nuevas |
| `apps/api/drizzle/0007…0011_*.sql` | Una migración por tarea 1–5 (la 6 no migra) |
| `apps/api/src/modules/{unitsOfMeasure,productCategories}/` | Módulos completos |
| `apps/api/src/modules/products/products.images.*` y `products.express.ts` | Imágenes: servicio, repositorio y ruta de subida |
| `apps/web/src/features/{units-of-measure,product-categories}/` | Pantallas, patrón de `features/event-types` |
| `apps/web/src/features/tenant/hooks/useCatalogVocabulary.ts` | Vocabulario por tipo de catálogo |

---

### Task 1: Renombrado `numPersons` → `quantity`

**Archivos:**
- Modificar: `apps/api/src/db/schema/{quotes,catalog}.ts`, repositories/services/resources de `modules/{quotes,products,events,dashboard}`, `lib/pdfService`/`quotes.pdf.ts`, seeds, `packages/schemas/src/{quotes,catalog}.ts`, web (`features/{quotes,catalog,events,clients}`), todos los tests, `docs/mach-bar-domain.md` y las arquitecturas donde se cite.
- Crear: `apps/api/drizzle/0007_quantity_rename.sql` (+ `meta/0007_snapshot.json` y entrada en `_journal.json`).

**Interfaces:**
- Produce: la propiedad `quantity` en lugar de `numPersons` en `quote_lines` y `product_price_tiers` (columna `quantity`), en todos los esquemas Zod, tipos, resources y props de la web. `minPersonsPerLine` **no** se toca aquí.

- [ ] **Paso 1:** inventario: `grep -rnE "numPersons|num_persons|NumPersons"` sobre `apps packages docs` (sin `node_modules`, `.next` ni `drizzle/meta`); guardar el conteo inicial en el reporte.
- [ ] **Paso 2:** cambiar el esquema TS (propiedad y nombre de columna) y generar la migración. Si `drizzle-kit` pregunta si es renombrado o creación, elegir renombrado; si no se puede conducir de forma no interactiva, escribir el SQL a mano y copiar el snapshot `0006` con las columnas renombradas. El SQL debe ser `ALTER TABLE … RENAME COLUMN num_persons TO quantity` en ambas tablas y `RENAME CONSTRAINT product_price_tiers_product_persons_unique TO product_price_tiers_product_quantity_unique`. Comprobar que un `db:generate` posterior no propone cambios.
- [ ] **Paso 3:** renombrar en API, esquemas, web, tests y seeds hasta que `grep` devuelva solo migraciones históricas; el payload al servicio de PDF ya usa `quantity`.
- [ ] **Paso 4:** `pnpm --filter api test`, `test:int` **completo**, `pnpm --filter web test`, y `check-types` de api, web y schemas en verde, con **cero cambios de aserciones** salvo el nombre del campo.
- [ ] **Paso 5:** staged y detenerse.

### Task 2: Tipo de catálogo, vocabulario y textos "estación"

**Archivos:**
- Crear: `packages/schemas/src/catalogKinds.ts` (+ export), `apps/api/src/db/schema/tenantProfile.ts`, `apps/api/drizzle/0008_tenant_profile.sql`, `apps/api/src/db/scripts/tenantProfile.ts` y `lib/tenancy/profile.ts` (comando y servicio sobre `platformDb()`), `apps/web/src/features/tenant/hooks/{useTenantProfile,useCatalogVocabulary}.ts`, `apps/web/src/locales/{es,en}/vocabulary.json`.
- Modificar: `db/schema/index.ts`, `db/rls/policy.ts` (`PLATFORM_MANAGED_TABLES` suma `tenant_profile`), `db/scripts/verifyMultitenant.ts` (comprobación de la tabla), `modules/tenant/{tenant.router,tenant.service,tenant.repository,tenant.resource}.ts` (consulta `tenant.profile`), `db/scripts/createTenant.ts` (`--catalog-kind`), `apps/api/package.json` (`tenant:set-catalog-kind`), los nueve archivos de traducción con "estación"/"station" (`catalog, roles, support, quotes, settings, api, admin, dashboard, events`), `features/events/components/detail/Station*.tsx` y las variables `station…` del código, y el menú ("Estaciones" → vocabulario).
- Pruebas: `db/rls/test/tenantProfile.rls.int.test.ts`, `lib/tenancy/test/profile.int.test.ts`, `modules/tenant/test/tenant.profile.int.test.ts`, helpers de vocabulario.

**Interfaces:**
- Produce: `CATALOG_KINDS = ['products','services'] as const`, `type CatalogKind`, `catalogKindSchema`, `DEFAULT_CATALOG_KIND = 'products'`.
- Produce: tabla `tenant_profile` (`tenant_id` PK, `catalog_kind text`, `updated_at`), política `SELECT` por organización (sin política de escritura), migración con relleno `'products'` para las organizaciones existentes.
- Produce: `getCatalogKind(executor, tenantId): Promise<CatalogKind>` (sin fila ⇒ `DEFAULT_CATALOG_KIND`); `setCatalogKind(db, { tenantSlug, kind }): Promise<void>` (valida contra el registro, upsert); `tenant.profile` ⇒ `{ catalogKind }` por la cadena normal (la RLS exige la transacción de la petición).
- Produce (web): `useTenantProfile(): { catalogKind: CatalogKind; isPending: boolean }`; `useCatalogVocabulary(): { item, items, Item, Items }` (cadenas ya resueltas, vocabulario neutro si el perfil aún carga); claves `vocabulary.<kind>.{item,items,Item,Items}` en es y en.

- [ ] **Paso 1: pruebas que fallan.** RLS: `app` lee su fila y no puede insertar, actualizar ni borrar (ni la propia); otra organización no la ve; `platform` escribe. Servicio: tipo desconocido rechazado; upsert; sin fila ⇒ `products`. `tenant.profile` solo devuelve el de la organización activa. Vocabulario: cada tipo × idioma tiene las cuatro formas y no hay claves faltantes entre es y en (prueba de paridad de claves).
- [ ] **Paso 2:** tabla, migración, política, registro, comando, servicio y consulta.
- [ ] **Paso 3:** reemplazar los textos: cada frase afectada pasa a interpolación (`{{item}}`/`{{items}}`) usando `useCatalogVocabulary()`; renombrar los componentes `Station*` y variables; el menú usa el vocabulario. `grep -rniE "estaci|station"` sobre `apps/web/src` y `packages` no debe dejar coincidencias salvo las de seeds (que limpia la tarea 6) y migraciones.
- [ ] **Paso 4:** `pnpm --filter api test`, `test:int` de `db/rls`, `modules/tenant` y `lib/tenancy`, `pnpm --filter web test` y `check-types` en verde.
- [ ] **Paso 5:** staged y detenerse.

### Task 3: Unidades de medida

**Archivos:**
- Crear: `packages/schemas/src/unitsOfMeasure.ts`, `apps/api/src/db/schema/unitsOfMeasure.ts`, `apps/api/drizzle/0009_units_of_measure.sql`, `apps/api/src/db/seeds/unitsOfMeasure.ts`, `apps/api/src/modules/unitsOfMeasure/{unitsOfMeasure.module,repository,resource,router,service}.ts`, `apps/web/src/features/units-of-measure/**`, `apps/web/src/app/admin/units-of-measure/page.tsx`, `apps/web/src/lib/format/quantity.ts` (+ test).
- Modificar: `db/schema/catalog.ts` (`products.uom_id`), `db/seeds/defaults.ts`, `modules/products/*` y `packages/schemas/src/catalog.ts` (`uomId` en el producto y su resource), `packages/guards/src/constants/resources.ts` + `mappings/{permissions.matrix,rolesPermissions.matrix,roleTemplates}.ts` (recurso `UNIT_OF_MEASURE` con CRUD y desactivar; los roles que administran el catálogo lo reciben), `core/trpc/router.ts`, `lib/navigation/constants/items.ts` (+ icono), formulario y vistas del producto, cantidad de líneas de cotización/evento y tramos.
- Pruebas: `modules/unitsOfMeasure/test/*.int.test.ts`, `db/seeds/test/unitsOfMeasure.int.test.ts`, `db/rls/test/rlsMigration.int.test.ts` (nueva tabla), `lib/format/test/quantity.test.ts`.

**Interfaces:**
- Produce: `UOM_DIMENSIONS = ['quantity','time','weight','volume','length'] as const`; `SYSTEM_UNITS: readonly { code; name; pluralName; dimension; factor: string; isBase: boolean }[]` con las 23 unidades y plurales del spec §4; esquemas `createUnitSchema`/`updateUnitSchema`.
- Produce: tabla `units_of_measure` (`tenant_id`, `name`, `plural_name`, `code`, `dimension` enum, `factor numeric(24,10)`, `is_base`, `is_system`, `is_active`, `sort_order`; único `(tenant_id, code)`; índice parcial único `(tenant_id, dimension) WHERE is_base`); `products.uom_id` `NOT NULL` con FK.
- Produce: `seedUnitsOfMeasure(tenantId: string, x?: Executor): Promise<void>` idempotente por código, llamado desde `seedTenantDefaults`.
- Produce: `formatQuantity(quantity: number, unit: { name: string; pluralName: string; code: string }, mode?: 'name' | 'code'): string` ("1 persona", "40 personas", "5 kg").
- Errores nuevos en `ErrorCodes`: `unit.NOT_FOUND`, `CODE_TAKEN`, `SYSTEM_IMMUTABLE`, `IN_USE`, `INVALID_FACTOR`.

- [ ] **Paso 1: pruebas que fallan.** Servicio/integración: código único por organización; una sola base por dimensión (base ⇒ `factor = 1`); `is_system` no se borra ni cambia de dimensión o factor (sí se renombra o desactiva); una unidad propia usada por un producto no cambia dimensión ni factor y no se desactiva si hay productos activos; aislamiento entre organizaciones. Seed: idempotente y con los 23 códigos. Migración (`rlsMigration`/prueba dedicada): el SQL inserta exactamente `SYSTEM_UNITS` para todas las organizaciones existentes y los productos existentes quedan con "Persona". `formatQuantity`: 0, 1 y N en es y en, y modo código.
- [ ] **Paso 2:** esquema TS, `db:generate`, revisar el SQL y completarlo a mano: relleno de unidades para todas las organizaciones, `uom_id` con valor "Persona" para los productos existentes antes de `SET NOT NULL`, `FORCE ROW LEVEL SECURITY`.
- [ ] **Paso 3:** módulo API (patrón `eventTypes`), permisos, menú y pantalla (`DataTable` + tarjeta en móvil, formulario en modal, columna de tipo, factor visible solo en unidades no base), selector de unidad en el producto y `formatQuantity` en cantidades y tramos. Sin textos que digan "personas" fijos.
- [ ] **Paso 4:** verde de `test`, `test:int` de las zonas tocadas, web y `check-types`.
- [ ] **Paso 5:** staged y detenerse.

### Task 4: Categorías y campos del producto

**Archivos:**
- Crear: `packages/schemas/src/productCategories.ts`, `apps/api/src/db/schema/productCategories.ts`, `apps/api/drizzle/0010_product_fields.sql`, `apps/api/src/modules/productCategories/*`, `apps/web/src/features/product-categories/**`, `apps/web/src/app/admin/product-categories/page.tsx`.
- Modificar: `db/schema/catalog.ts` (`sku`, `cost`, `min_quantity`, `category_id`), `db/schema/config.ts`, `db/seeds/config.ts`, `modules/config/config.resource.ts`, `packages/schemas/src/{config,catalog}.ts` (se elimina `minPersonsPerLine`), `modules/products/*` (resource con costo condicional), `modules/quotes/quotes.service.ts` (`validateLine` usa `product.minQuantity`), guards (recursos `PRODUCT_CATEGORY` y `PRODUCT_COST` con `read`/`update`, matrices y plantillas), menú, formulario y detalle del producto, filtro por categoría, `features/settings/{helpers.ts,components/forms/QuoteDefaultsCard.tsx}`, `features/quotes/{lineHelpers.ts,hooks/useLineConfig.ts,components/builder/**}` (mínimo por producto), `locales/*/settings.json`, tests y fixtures que citan `min_persons_per_line` (`legacyFixture.ts`, `migration.0001.int.test.ts`).

**Interfaces:**
- Produce: `products.sku` (único por `(tenant_id, sku)` cuando no es nulo), `products.cost integer` nullable (centavos), `products.min_quantity integer NOT NULL DEFAULT 1 CHECK (>= 1)`, `products.category_id` nullable con FK `ON DELETE RESTRICT`; tabla `product_categories` (`tenant_id`, `name` único por organización, `is_active`, `sort_order`).
- Produce: `productResource(row, { canSeeCost: boolean })` y árbol/lista/duplicar que omiten `cost` sin permiso; `createProduct`/`updateProduct` rechazan `cost` sin el permiso con `ErrorCodes.product.COST_FORBIDDEN`.
- Produce: migración que copia `app_settings.min_persons_per_line` a `products.min_quantity` de cada producto de su organización y luego elimina la columna `min_persons_per_line`.

- [ ] **Paso 1: pruebas que fallan.** SKU único (y repetible si es nulo); categoría única por nombre y `RESTRICT` con productos; **el costo ausente en `list`, `catalog`, árbol, duplicar y cualquier respuesta de cotización/evento sin `product_cost`, presente con él, y escribirlo sin permiso falla**; la migración copia el mínimo por organización; `validateLine` exige `quantity >= product.minQuantity` para quien no gestiona precios; las cotizaciones ya creadas no se revalidan; el ajuste de configuración ya no existe en API ni en Configuración.
- [ ] **Paso 2:** esquema, migración (relleno y eliminación de la columna incluidos) y módulo de categorías (patrón `eventTypes`), permisos, menú y pantalla.
- [ ] **Paso 3:** campos en el formulario y detalle del producto (costo solo con permiso, con `<Can>`/`useCan`), cantidad mínima en el cotizador, filtro por categoría y retirada del control de Configuración.
- [ ] **Paso 4:** verde de `test`, `test:int` de `modules/{products,quotes,config,productCategories}`, `db/scripts` y web, y `check-types`.
- [ ] **Paso 5:** staged y detenerse.

### Task 5: Imágenes de producto

**Archivos:**
- Crear: `packages/schemas/src/productImages.ts` (`PRODUCT_IMAGES_MAX = 5`, `PRODUCT_IMAGE_ALLOWED_MIME_TYPES`, `PRODUCT_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024`), `apps/api/src/db/schema/productImages.ts`, `apps/api/drizzle/0011_product_images.sql`, `apps/api/src/modules/products/{products.images.service,products.images.repository,products.express}.ts`, `apps/api/src/lib/images/processImage.ts`, `apps/web/src/features/catalog/components/ProductGallery.tsx` y hooks.
- Modificar: `apps/api/package.json` (dependencia `sharp` y `--external:sharp` en `build`), `server.ts` (monta la ruta Express), `modules/products/products.{resource,router,module}.ts` (`images[]` y mutaciones de destacar, reordenar y borrar), `lib/errors/constants.ts`, `features/quotes/helpers.ts` (se elimina `getStationIcon` y `STATION_ICON_RULES`), `lib/navigation/constants/icons.tsx` (rastro de estaciones), `modules/quotes/quotes.pdf.ts` (se elimina el mapa de emojis por nombre), listas y selectores que usaban el icono por nombre (miniatura o marcador neutro).
- Pruebas: `products.images.int.test.ts`, `lib/images/test/processImage.test.ts`, `products.express.int.test.ts`.

**Interfaces:**
- Produce: tabla `product_images` (`tenant_id` + RLS, `product_id` con cascada, `image_key`, `image_url`, `thumb_key`, `thumb_url`, `file_name`, `size`, `width`, `height`, `sort_order`, `is_featured`, `created_by_id`, `created_at`; índice único parcial `(product_id) WHERE is_featured`).
- Produce: `processImage(input: Buffer): Promise<{ image: Buffer; thumb: Buffer; width: number; height: number }>` (rechaza lo que no sea imagen decodificable o supere el límite de píxeles; corrige orientación; sin EXIF; WebP 1600 px y 400 px máximos); `sharp` se importa con `await import('sharp')` solo dentro de la función.
- Produce: `POST` Express `…/products/:productId/images` (guard `product:update`, `multer` en memoria) con las tres fases del spec §6; mutaciones tRPC `products.images.{setFeatured,reorder,delete}`; errores `productImage.{LIMIT_REACHED,INVALID_IMAGE,TOO_LARGE,UPLOAD_FAILED}`.
- Produce (web): `ProductGallery` (AntD `Upload`, subir, destacar, reordenar, borrar, contador `n/5`, mobile-first) y marcador neutro cuando no hay imágenes.

- [ ] **Paso 1: pruebas que fallan.** `processImage` con imágenes generadas en la prueba (válida, no imagen, demasiados píxeles, con orientación EXIF) y salida en los tamaños esperados. Integración con el proveedor de almacenamiento simulado: máximo de 5 **también con subidas simultáneas**, una sola destacada y la primera lo es, borrar la destacada promueve la siguiente, R2 queda limpio si falla la fase 3 y tras borrar, aislamiento entre organizaciones, y el permiso/módulo del guard.
- [ ] **Paso 2:** esquema, migración, `processImage`, servicio en tres fases (transacciones cortas con `runInTenant`, sin transacción abierta durante `sharp` ni R2), ruta Express y mutaciones tRPC.
- [ ] **Paso 3:** galería web, miniaturas en listas y selectores, retirada de iconos y emojis por nombre; el PDF deja de usar emojis (mostrar imágenes en el PDF **no** entra: depende del servicio externo).
- [ ] **Paso 4:** verde de `test`, `test:int` de `modules/products`, web y `check-types`; confirmar que `pnpm --filter api build` empaqueta con `sharp` como externo.
- [ ] **Paso 5:** staged y detenerse.

### Task 6: Seeds, demo y documentación

**Archivos:**
- Modificar: `apps/api/src/db/seeds/{catalog,demo,quotes,quotePdfTemplate}.ts` (productos neutros con unidad, categoría y precio, tramos y opciones donde la demo los use; sin `Fruit Station` ni `Snack Station`), sus tests, `docs/mach-bar-domain.md` (nota que remite al catálogo genérico), `docs/backend/architecture.md` (módulos de unidades y categorías, `tenant_profile`, imágenes y `sharp`, regla de no atar nombres al cliente), `docs/frontend/architecture.md` (`useCatalogVocabulary`, `formatQuantity`, galería), `docs/superpowers/runbooks/multitenant-cutover.md` (sección de esta fase: migraciones `0007`–`0011`, comando `tenant:set-catalog-kind`, `sharp` en el despliegue, rollback).

- [ ] **Paso 1:** actualizar seeds y sus pruebas (el seed de demo sigue activando todas las features y asigna unidades y tipo de catálogo).
- [ ] **Paso 2:** documentación; verificar con `grep` cada símbolo, ruta, script y código de error citado.
- [ ] **Paso 3:** corrida completa: `pnpm check-types`, `pnpm test`, `pnpm --filter api test:int` de punta a punta; `grep -rniE "estaci|station"` sobre `apps packages` (sin `node_modules`) solo puede devolver migraciones históricas y `docs/mach-bar-domain.md`.
- [ ] **Paso 4:** staged y detenerse.
