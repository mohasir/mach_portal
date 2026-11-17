# Impuesto por línea y cargos adicionales: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** impuesto por producto y por línea (tasa congelada en la línea), descuento repartido entre líneas, y cargos adicionales por organización detrás del add-on `extraCharges`; se elimina el impuesto por estado y el aviso de tasas desactualizadas.

**Arquitectura:** migración 0014 (tasas en organización, producto y línea; se quita el impuesto por estado) con el cálculo compartido en `@repo/schemas`; migración 0015 (catálogo `charge_types` y `quote_charges`, que reemplazan larga distancia y recargo por tarjeta) con su módulo y add-on; la web consume ambas.

**Stack:** Drizzle + Postgres, zod, Vitest, tRPC, Next 15 + AntD v6 + Tailwind v4, i18next.

**Spec:** `docs/superpowers/specs/2026-11-16-impuesto-por-linea-design.md` (autoridad). Leer también `CLAUDE.md`, `docs/backend/architecture.md` (§8 migraciones, §11 multi-tenant), `docs/frontend/architecture.md`, `docs/frontend/styling-guide.md` y `docs/mach-bar-domain.md` §7 (cascada de precios).

## Restricciones globales

- Rama `feat/impuesto-por-linea`. Sin commit, push ni merge sin OK explícito del usuario: cada tarea deja sus archivos en staged con rutas explícitas (nunca `git add -A`) y se detiene. No usar `git stash`. Sin atribución de Claude en commits.
- Comentarios en inglés, solo para un *porqué* no obvio; nada que dependa de la conversación.
- Backend: `resource → repository → service → router`, repositories `(db, tenantId)` con `tenantEq`, todo id de `input` resuelto con lecturas del tenant, pruebas de aislamiento; errores con `AppError`/`ErrorCodes`; permisos con `guardedProcedure` y `@repo/guards`.
- Esquema: cambiar el TS, `db:generate`, revisar y editar el SQL a mano (relleno antes de `SET NOT NULL`), `when` estrictamente mayor que el anterior y no futuro (`migrationJournal.test.ts`); luego `db:generate` no propone nada. 0014 sigue a la 0013; 0015 a la 0014.
- Cálculo en un solo lugar (`computeQuoteTotals` en `@repo/schemas`), compartido por vista previa (web), guardado (API) y PDF; dinero en centavos enteros; los restos de redondeo no se pierden (la suma de partes es exacta).
- Web: mobile-first, AntD v6 + Tailwind v4, `lucide-react`, sin inline styles, sin hex, sin `uppercase`; i18n es/en con claves paralelas y test de paridad.
- **Prohibido** correr `db:migrate`, `db:fresh`, `db:reset`, `db:seed`, `feature:*`, `tenant:*` contra una base real, levantar servidores o abrir el navegador. Las pruebas de integración usan una base descartable propia (`mach_test_*`, se borra al terminar). Nunca leer `.env`.
- Verificación: tras las tareas 1 y 2 el monorepo puede tener la web en rojo por los tipos compartidos (se resuelve en la tarea 3); esas tareas verifican `@repo/schemas` y `api` (`check-types`, `test`, `test:int` de lo tocado). La tarea 3 corre todo (`pnpm check-types`, `pnpm test`, `test:int` completo).

## Foco de revisión

1. **Redondeo exacto:** con descuento, tasas mixtas, líneas exentas y centavos sobrantes, la suma de descuentos asignados es igual al descuento y la suma de impuestos de línea al impuesto total; sin descuento ni exentas el total coincide con el de la fórmula anterior.
2. **Línea congelada:** cambiar la tasa del producto o de la organización no altera líneas ya guardadas; una línea reenviada sin cambios conserva su tasa e impuesto; una línea nueva o editada toma la tasa vigente del producto (0 si exento).
3. **Totales guardados intactos:** tras migrar, ninguna cotización existente cambia `subtotal`, `tax_amount`, `total`, `deposit_amount`; la suma de `quote_lines.tax_amount` por cotización es igual a su `tax_amount`.
4. **Cargos hostiles:** un `charge_type_id` de otro tenant, inexistente, inactivo o enviado sin el add-on se rechaza sin escribir nada; un cargo en porcentaje fuera de rango o un monto negativo se rechaza.
5. **Add-on apagado:** las cotizaciones con cargos siguen leyéndose y el total se recalcula sin pérdida; no se pueden aplicar cargos nuevos ni editar el catálogo.

---

### Task 1: Impuesto por línea (datos, cálculo y API)

**Archivos:**
- Modificar: `apps/api/src/db/schema/config.ts` (quitar `stateSettings`, `applyTaxByState`, `promptRateChanges`; agregar `defaultTaxRate`), `apps/api/src/db/schema/catalog.ts` (`taxRate`, `taxExempt`), `apps/api/src/db/schema/quotes.ts` (`quoteLines.taxRate/taxAmount`; quitar `quotes.taxRate` y `declinedRates`), `packages/schemas/src/{config,quotes,catalog}.ts` (esquemas y `computeQuoteTotals`; eliminar `quoteRateDrift`, `resolveQuoteRates`, `needsConfigRates` y el esquema de resolución del aviso), `apps/api/src/modules/config/*`, `apps/api/src/modules/products/*` (repository, service, resource), `apps/api/src/modules/quotes/{quotes.repository,quotes.service,quotes.resource,quotes.router,quotes.pdf}.ts`, `apps/api/src/db/seeds/{config,quotes,catalog,demo}.ts`, `apps/api/src/db/scripts/verifyMultitenant.ts`, `apps/api/src/db/schema/test/tenantTables.test.ts`, fixtures y pruebas que citen lo removido, `docs/backend/architecture.md`, `docs/mach-bar-domain.md` §7.
- Crear: `apps/api/drizzle/0014_line_tax.sql` (+ snapshot y journal), `apps/api/src/db/scripts/test/migration.0014.int.test.ts`, `packages/schemas/src/test/quoteTotals.test.ts` (o el lugar de pruebas del paquete), `apps/api/src/modules/quotes/test/quotes.lineTax.int.test.ts`.

**Interfaces:**
- Produce:
  - `app_settings.default_tax_rate`, `products.tax_rate`/`tax_exempt`, `quote_lines.tax_rate`/`tax_amount` (numeric(6,5) y integer).
  - `computeQuoteTotals(input: QuoteTotalsInput): QuoteTotals` con `QuoteTotalsInput = { lines: { subtotal: number; taxRate: number }[]; discountType?; discountValue?; longDistanceAmount?; applyCardSurcharge?; cardSurchargeRate; depositRate }` (sin `taxRate` único). `QuoteTotals` agrega `lines: { discountShare: number; taxAmount: number }[]` y `taxBreakdown: { taxRate: number; base: number; taxAmount: number }[]`; `taxAmount` es la suma. Larga distancia y recargo por tarjeta se calculan **fuera de la base gravable**: larga distancia suma su monto después del impuesto y el recargo por tarjeta es `round(total con impuesto × tasa)`.
  - Recurso de producto: `taxRate`, `taxExempt`; recurso de línea de cotización: `taxRate`, `taxAmount`; config: `defaultTaxRate`.
- Consume: `computeQuoteTotals` actual (cascada de `docs/mach-bar-domain.md` §7) y el patrón de línea congelada de `quotes.service.ts` (`changedLines`, `resolveLineUnits`, `uomId`).

- [ ] **Paso 1: pruebas primero (rojo).** `quoteTotals.test.ts`: una línea a una tasa (igual al resultado anterior sin descuento), tasas mixtas, línea exenta, descuento fijo y en porcentaje repartido con resto por mayor residuo (suma exacta, casos de 1 y 3 líneas con centavos sobrantes), descuento mayor al subtotal acotado, desglose por tasa, anticipo. En `quotes.lineTax.int.test.ts`: línea nueva toma la tasa del producto (0 si exento), cambiar la tasa del producto no altera la línea guardada, reenviar sin cambios conserva tasa e impuesto, editar la cantidad recalcula con la tasa vigente. En productos: `taxRate`/`taxExempt` en crear, actualizar, duplicar y recurso; sin `taxRate` al crear toma `defaultTaxRate` de la organización; aislamiento. En `migration.0014.int.test.ts`: relleno de tasas y `tax_amount`, totales de cotización intactos, suma de impuestos de línea igual a `tax_amount` de la cotización.
- [ ] **Paso 2: esquema Drizzle y `@repo/schemas`.** Cambios de columnas y nuevos esquemas; `computeQuoteTotals` por línea; eliminar el código del impuesto por estado y del aviso de tasas (tipos, esquemas, constantes y su uso).
- [ ] **Paso 3: migración 0014.** `pnpm --filter api db:generate`; editar el SQL a mano: `default_tax_rate` = tasa de la cotización más reciente de la organización (0 si no hay); `products.tax_rate` = esa tasa; `quote_lines.tax_rate` = `quotes.tax_rate`; `quote_lines.tax_amount` repartiendo `quotes.tax_amount` entre las líneas por mayor residuo del impuesto ideal (la suma por cotización es exacta); luego `SET NOT NULL`, y `DROP` de `state_settings`, `apply_tax_by_state`, `prompt_rate_changes`, `quotes.tax_rate`, `quotes.declined_rates`. Verificar `when` y que `db:generate` no propone nada. Añadir las entradas necesarias en `verifyMultitenant` y quitar las de `state_settings`.
- [ ] **Paso 4: config y productos.** Config: leer/escribir `defaultTaxRate`, sin tasas por estado ni aviso. Productos: campos nuevos en repository, service y resource (`?? defaultTaxRate` al crear; `taxExempt` fuerza 0 al cotizar).
- [ ] **Paso 5: cotizaciones.** Al crear o editar copiar la tasa del producto a cada línea; guardar `tax_amount` de línea y `tax_amount`/`total` de la cotización con `computeQuoteTotals`; línea reenviada sin cambios conserva tasa e impuesto (misma lógica de congelada que la unidad); eliminar el aviso de tasas (rutas y servicio de resolución). La vista previa del PDF y el recurso exponen impuesto por línea y desglose.
- [ ] **Paso 6: seeds y docs.** Seeds neutros con `default_tax_rate`, tasas por producto y líneas con `tax_rate`/`tax_amount`; demo coherente. Actualizar `docs/backend/architecture.md` (módulos, cascada) y `docs/mach-bar-domain.md` §7.
- [ ] **Paso 7: verde.** `pnpm --filter api check-types`, `pnpm --filter api test`, `pnpm --filter api test:int` completo en base descartable; grep de `applyTaxByState|state_settings|stateSettings|declinedRates|quoteRateDrift|promptRateChanges` sin usos en `apps/api` y `packages`. La web puede quedar en rojo (tarea 3).
- [ ] **Paso 8:** dejar en staged las rutas tocadas y detenerse; reporte en el archivo que indique el controlador.

---

### Task 2: Cargos adicionales (add-on `extraCharges`)

**Archivos:**
- Modificar: `packages/guards/src/features/registry.ts` (`extraCharges`, addon), `packages/guards` (recurso `charge_type`, acciones, plantillas de rol y pruebas de permisos), `apps/api/src/db/schema/{quotes,config}.ts` y `packages/schemas/src/{quotes,config}.ts` (quitar larga distancia y recargo por tarjeta; cargos de la cotización en la entrada), `computeQuoteTotals`, `apps/api/src/modules/quotes/*` (crear/editar con cargos, recurso, PDF), `apps/api/src/core/trpc/router.ts` (montar el router), seeds, `verifyMultitenant.ts`, `tenantTables.test.ts`, `docs/backend/architecture.md`, runbook `docs/superpowers/runbooks/multitenant-cutover.md`.
- Crear: `apps/api/drizzle/0015_extra_charges.sql` (+ snapshot y journal), `apps/api/src/db/schema/charges.ts`, `packages/schemas/src/charges.ts`, `apps/api/src/modules/chargeTypes/` (`chargeTypes.{resource,repository,service,module,router}.ts`), pruebas (`chargeTypes.*.int.test.ts`, `quotes.charges.int.test.ts`, `migration.0015.int.test.ts`, `computeQuoteTotals` con cargos).

**Interfaces:**
- Produce:
  - Tablas `charge_types` (`id, tenant_id, name, kind 'fixed'|'percent', default_value, is_active, sort_order`; nombre único por organización) y `quote_charges` (`id, tenant_id, quote_id, charge_type_id` nullable `SET NULL, name, kind, value, amount`).
  - `QuoteTotalsInput.charges?: { kind: 'fixed' | 'percent'; value: number }[]` (valor en centavos o tasa numeric(6,5) según `kind`) y `QuoteTotals.charges: { amount: number }[]`; `longDistanceAmount` y `applyCardSurcharge` desaparecen de entrada y salida; `total = total con impuesto + suma de cargos`.
  - Router `chargeTypes`: `list`, `options`, `create`, `update`, `disable`, `enable`; mutaciones con `requireFeature('extraCharges')`.
  - Entrada de cotización: `charges: { chargeTypeId: string; value?: number }[]` (omitido el valor usa el por defecto del tipo).
- Consume: `computeQuoteTotals` de la tarea 1, el patrón de add-on (`requireFeature`, `useFeature`) y el de módulo CRUD con orden (p. ej. `productCategories`).

- [ ] **Paso 1: pruebas primero (rojo).** `computeQuoteTotals` con cargos fijos y en porcentaje (cada uno sobre el total con impuesto, sin componerse, sin impuesto sobre ellos, anticipo sobre el total final). `chargeTypes`: CRUD, nombre único, aislamiento por organización, mutaciones bloqueadas sin el add-on y lecturas abiertas. `quotes.charges`: aplicar cargos del catálogo con y sin valor propio, copia de nombre/tipo/valor/monto, tipo ajeno/inexistente/inactivo o sin add-on rechazado sin escribir, porcentaje fuera de rango y monto negativo rechazados, cotización con cargos sigue legible y recalcula al editar con el add-on apagado sin perder cargos existentes. `migration.0015`: organizaciones con larga distancia o recargo usados reciben sus tipos y sus `quote_charges` con el monto guardado; organizaciones sin uso no reciben tipos ni el add-on; totales guardados intactos.
- [ ] **Paso 2: esquema Drizzle, permisos y `@repo/schemas`.** Nuevas tablas y esquemas; recurso `charge_type` en `@repo/guards` con sus acciones y plantillas de rol; `extraCharges` en el registro; quitar las columnas y campos viejos.
- [ ] **Paso 3: migración 0015.** `db:generate` y edición a mano: crear tablas con RLS; por cada organización con alguna cotización con `long_distance_amount > 0` crear el tipo "Larga distancia" (fijo, valor por defecto 0) y su `quote_charges` por cotización con el monto guardado; por cada organización con alguna cotización con `apply_card_surcharge` crear "Recargo por tarjeta" (porcentaje, valor por defecto = `app_settings.card_surcharge_rate`) y su `quote_charges` con la tasa y el monto guardados; activar `extraCharges` (fila permanente, sin precio) solo en esas organizaciones; luego quitar las columnas viejas y `app_settings.card_surcharge_rate`. Agregar las FKs a `verifyMultitenant`.
- [ ] **Paso 4: módulo `chargeTypes`.** `resource → repository → service → router` según `docs/backend/architecture.md` y el módulo de categorías como modelo; permisos y errores propios (`CHARGE_TYPE_NOT_FOUND`, nombre duplicado, valor inválido).
- [ ] **Paso 5: cotizaciones.** Aceptar `charges` en crear y editar (ids resueltos con lecturas del tenant, `requireFeature` equivalente en la lógica de la cotización), copiar nombre/tipo/valor/monto a `quote_charges` y recalcular con `computeQuoteTotals`; recurso y PDF con los cargos; sin el add-on los cargos existentes se conservan y no se pueden agregar nuevos.
- [ ] **Paso 6: seeds, docs y runbook.** Seeds con un par de cargos de ejemplo y el add-on activo en las organizaciones demo; `docs/backend/architecture.md` (add-ons y módulo) y runbook (migración 0015: relleno, activación automática, rollback).
- [ ] **Paso 7: verde.** `pnpm --filter api check-types`, `pnpm --filter api test`, `pnpm --filter api test:int` completo en base descartable; grep de `longDistance|cardSurcharge|applyCardSurcharge` sin usos en `apps/api` y `packages` (salvo migraciones y la lógica de relleno).
- [ ] **Paso 8:** dejar en staged las rutas tocadas y detenerse.

---

### Task 3: Web (Ajustes, producto, cotizador y detalle)

**Archivos:**
- Modificar: `apps/web/src/features/settings/components/forms/{TaxRatesCard,QuoteBuilderPreferencesCard}.tsx` y `apps/web/src/features/settings/helpers.ts` (+ prueba; tasa por defecto en lugar de tasas por estado), `apps/web/src/features/catalog/{helpers.ts,components/ProductForm.tsx,components/ProductDetailPage.tsx,components/ProductFormModal.tsx,types.ts}` (+ pruebas), `apps/web/src/features/quotes/{helpers.ts,quotes.store.ts,components/QuoteSummary.tsx,components/builder/{EventSection,ExtraChargesSection,PricingPanel,QuoteBuilderContent}.tsx,components/builder/QuotePreview/index.tsx,components/detail/QuoteDetailCard.tsx,hooks/useQuoteRatesPrompt.tsx}` (eliminar el aviso de tasas), locales `apps/web/src/locales/{es,en}/{quotes,settings,catalog,common,api}.json`, `apps/web/src/lib/navigation` (ítem de cargos), `docs/frontend/architecture.md`.
- Crear: `apps/web/src/features/charge-types/` (página y formulario de cargos con `DataTable`, hooks tRPC, tipos, `index.ts`), `apps/web/src/app/admin/charge-types/page.tsx`, y pruebas de los helpers nuevos.

**Interfaces:**
- Consume (tareas 1 y 2): `computeQuoteTotals` por línea con `taxBreakdown` y `charges`; producto con `taxRate`/`taxExempt`; config con `defaultTaxRate`; router `chargeTypes`; entrada de cotización con `charges`; feature `extraCharges`.
- Produce: pantalla de cargos (solo con el add-on; ítem de navegación y ruta con `feature: 'extraCharges'`); resumen del cotizador con impuesto por línea o por tasa; sección de cargos extra con los tipos activos del catálogo activables y con valor ajustable, visible solo con el add-on; formulario de producto con tasa (prellenada con la de la organización) y exento.

- [ ] **Paso 1: pruebas primero (rojo).** Helpers: mapeo del formulario de producto (tasa, exento, exento fuerza 0 y deshabilita la tasa), tasa por defecto de Ajustes, mapeo de cargos del cotizador a la entrada de la API (id y valor opcional), y que el total de la vista previa usa el mismo `computeQuoteTotals` que la API con tasas mixtas, descuento y cargos. Paridad de locales es/en.
- [ ] **Paso 2: Ajustes.** Reemplazar la tarjeta de tasas por estado por una tasa por defecto; quitar la preferencia de impuesto por estado y el aviso de tasas; texto de ayuda sobre que la tasa se copia al crear productos y no cambia líneas ya cotizadas.
- [ ] **Paso 3: producto.** Campo de tasa (`%`, prellenado desde `defaultTaxRate` al crear) e interruptor "Exento de impuesto" en formulario y detalle; mobile-first.
- [ ] **Paso 4: cotizador y detalle.** Resumen con impuesto por línea o desglose por tasa; sección de cargos extra con los tipos activos (`chargeTypes.options`) solo con `useFeature('extraCharges')`; con cargos ya aplicados y el add-on apagado se muestran en solo lectura; eliminar el diálogo y el store del aviso de tasas. Vista previa y detalle usan `computeQuoteTotals` compartido.
- [ ] **Paso 5: pantalla de cargos.** `features/charge-types` (feature-sliced según `docs/frontend/architecture.md`): lista, crear, editar, activar/desactivar, `<Can>`/`useCan`, tarjeta en móvil; ruta y navegación solo con el add-on; textos i18n.
- [ ] **Paso 6: docs.** `docs/frontend/architecture.md`: sección breve de impuesto por línea, cargos y el add-on.
- [ ] **Paso 7: verde.** `pnpm check-types`, `pnpm test`, `pnpm --filter api test:int` completo en base descartable y `prettier --check` de lo tocado. No se prueba en vivo: dejar en el reporte qué debe probar el usuario (cotización con tasas mixtas y un producto exento, descuento, cargos con y sin add-on, una cotización vieja tras la migración, Ajustes, móvil).
- [ ] **Paso 8:** dejar en staged las rutas tocadas y detenerse.
