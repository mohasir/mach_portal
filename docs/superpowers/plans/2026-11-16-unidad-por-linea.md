# Unidad de medida por línea de cotización: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** que cada línea de cotización guarde la unidad con la que se cotizó, de modo que cambiar la unidad de un producto no altere cotizaciones existentes, y eliminar el bloqueo actual de cambio de unidad.

**Arquitectura:** columna `quote_lines.uom_id` (migración 0013, rellenada desde el producto); `QuoteLineInput` admite `uomId` opcional validado contra las líneas previas de la misma cotización; las lecturas de cotización y evento devuelven `unit` por línea y la web lo usa en lugar de `product.unit`; se retira `PRODUCT_UNIT_IN_USE`/`unitLocked`.

**Stack:** Drizzle + Postgres, zod, Vitest, tRPC, Next 15 + AntD v6, i18next.

**Spec:** `docs/superpowers/specs/2026-11-16-unidad-por-linea-design.md` (autoridad). Leer también `CLAUDE.md`, `docs/backend/architecture.md` (§11 multi-tenant) y `docs/frontend/architecture.md`.

## Restricciones globales

- Misma rama `feat/catalogo-generico`, encima de la migración 0012. Sin commit, push ni PR sin OK explícito del usuario: cada tarea deja sus archivos en staged con rutas explícitas (nunca `git add -A`) y se detiene. Sin atribución de Claude en commits. No usar `git stash`.
- Comentarios en inglés, solo cuando explican un *porqué* no obvio; nada que dependa de la conversación.
- Backend: `resource → repository → service → router`, repositories `(db, tenantId)` con `tenantEq`; todo id que llega en `input` se resuelve con lecturas del tenant.
- Esquema: cambiar el TS, `db:generate`, revisar y editar el SQL (relleno antes de `SET NOT NULL`), `when` de la 0013 estrictamente mayor que el de la 0012 y no futuro (`migrationJournal.test.ts`); luego `db:generate` no propone nada.
- Web: mobile-first, AntD v6 + Tailwind v4, `lucide-react`, sin inline styles, sin hex, sin `uppercase`; i18n es/en con claves paralelas.
- **Prohibido** correr `db:migrate`, `db:fresh`, `db:reset`, `db:seed`, `feature:*`, `tenant:*` contra una base real, levantar servidores o abrir el navegador. Las pruebas de integración usan una base descartable propia (`mach_test_*`, se borra al terminar). Nunca leer `.env`.
- Verificación por tarea: `pnpm --filter <paquete> check-types` y `test`; en la API, `test:int` de lo tocado; la última tarea corre todo.

## Foco de revisión

1. **Cambio de unidad no altera lo cotizado:** tras cambiar `products.uom_id`, una cotización existente sigue devolviendo la unidad original en cada línea.
2. **Edición conserva la unidad:** `replaceLines` borra y reinserta; la línea que ya existía mantiene su unidad y una línea nueva toma la actual del producto.
3. **`uomId` hostil:** un id de otro tenant, inexistente, o de una unidad que ninguna línea previa de esa cotización y producto respalda, se rechaza sin escribir nada.
4. **Relleno de la migración:** ninguna línea queda con `uom_id` nulo ni con una unidad distinta a la del producto al migrar.
5. **Unidades en uso:** una unidad usada solo por líneas de cotización (ningún producto la usa ya) no se puede borrar ni desactivar.

---

### Task 1: Datos, API y pruebas

**Archivos:**
- Modificar: `apps/api/src/db/schema/quotes.ts` (columna e índice), `packages/schemas/src/quotes.ts` (`quoteLineInputSchema`), `apps/api/src/modules/quotes/quotes.repository.ts` (`buildLineRows`, `insertLines`, `replaceLines`, lectura de líneas con unidad), `apps/api/src/modules/quotes/quotes.resource.ts` (`publicQuoteLineColumns`, `QuoteLineDetail`, `buildQuoteLineDetails`), `apps/api/src/modules/quotes/quotes.service.ts` (resolución y validación de `uomId`), `apps/api/src/modules/events/events.resource.ts` y `events.repository.ts` (si leen líneas sin unidad), `apps/api/src/modules/unitsOfMeasure/unitsOfMeasure.repository.ts` y `.service.ts` (uso por líneas), `apps/api/src/modules/products/products.service.ts`, `products.repository.ts` y `products.resource.ts` (quitar bloqueo), `apps/api/src/lib/errors/constants.ts` (quitar `UNIT_IN_USE`), `apps/api/src/db/seeds/quotes.ts` (las líneas del seed llevan `uomId` del producto), pruebas en `apps/api/src/modules/{quotes,products,unitsOfMeasure,events}/test/` y en `apps/api/src/db/scripts/test/`.
- Crear: `apps/api/drizzle/0013_quote_line_units.sql` (+ snapshot y journal de drizzle-kit), `apps/api/src/modules/quotes/test/quotes.lineUnits.int.test.ts`, `apps/api/src/db/scripts/test/migration.0013.int.test.ts`.

**Interfaces:**
- Produce: `quote_lines.uomId` (`uom_id`, uuid, NOT NULL, FK a `unitsOfMeasure.id`, índice `(tenant_id, uom_id)`); `quoteLineInputSchema` con `uomId: z.uuid().optional()`; cada línea de `QuoteLineDetail` trae `unit: { id, name, pluralName, code, dimension }` (misma forma que `UnitRef` de producto) y `uomId`; el recurso de producto deja de exponer `unitLocked`.
- Consume: `UnitRef`/`unitRefResource` de `products.resource.ts` (reutilizar, no duplicar).

- [ ] **Paso 1: pruebas primero (rojo).** En `quotes.lineUnits.int.test.ts`: (a) cambiar la unidad del producto no cambia la unidad de las líneas ya guardadas; (b) editar la cotización sin `uomId` en una línea existente la reinserta con la unidad actual del producto, y con el `uomId` de la línea original la conserva; (c) línea nueva sin `uomId` toma la actual del producto; (d) `uomId` de otro tenant, inexistente o sin línea previa de esa cotización y producto que lo respalde se rechaza y no escribe nada; (e) aislamiento por organización. En `unitsOfMeasure`: una unidad usada solo por `quote_lines` no se borra ni desactiva. En `products`: cambiar la unidad de un producto cotizado ahora funciona (reemplaza la prueba de `PRODUCT_UNIT_IN_USE`) y el recurso ya no trae `unitLocked`. En `migration.0013.int.test.ts`: tras migrar, cada línea tiene la unidad de su producto y ninguna es nula.
- [ ] **Paso 2: esquema Drizzle y `@repo/schemas`.** Columna, FK e índice en `quotes.ts`; `uomId` opcional en `quoteLineInputSchema`.
- [ ] **Paso 3: migración 0013.** `pnpm --filter api db:generate`; editar el SQL a mano: `ADD COLUMN "uom_id" uuid`, `UPDATE "quote_lines" SET "uom_id" = "products"."uom_id" FROM "products" WHERE "products"."id" = "quote_lines"."product_id"`, `SET NOT NULL`, FK e índice. Verificar `when` y que una segunda corrida de `db:generate` no propone nada.
- [ ] **Paso 4: repositorio y servicio de cotizaciones.** `buildLineRows` recibe la unidad resuelta por línea. `resolveLineUnits(tx, quoteId | undefined, lines)` en el repositorio/servicio: sin `uomId` usa `products.uom_id`; con `uomId` distinto al actual exige una línea previa de esa cotización y producto con esa unidad (lectura del tenant); si no, error de validación existente del módulo (o `AppError` nuevo de cotizaciones, sin reutilizar códigos de producto). `replaceLines` resuelve las unidades **antes** de borrar.
- [ ] **Paso 5: lecturas.** `publicQuoteLineColumns` y `buildQuoteLineDetails` devuelven `uomId` y `unit` (join a `unitsOfMeasure` dentro del tenant); ajustar los lectores de eventos que arman líneas.
- [ ] **Paso 6: unidades en uso.** En `unitsOfMeasure.repository.ts`, la comprobación de "en uso" incluye `quote_lines` (borrar siempre; desactivar según la regla actual de productos activos más cualquier línea).
- [ ] **Paso 7: retirar el bloqueo de producto.** Quitar la comprobación en `updateProduct`, `isProductQuoted`, `unitLocked` (y la consulta de uso que solo lo alimentaba), y `ErrorCodes.product.UNIT_IN_USE`; limpiar pruebas y textos de API en `apps/web/src/locales/{es,en}/api.json` (`PRODUCT_UNIT_IN_USE`) manteniendo paridad.
- [ ] **Paso 8: seeds y docs.** `seeds/quotes.ts` rellena `uomId`; nota en `docs/backend/architecture.md` (la unidad de la línea es copia al cotizar) y en el runbook `multitenant-cutover.md` (migración 0013, relleno).
- [ ] **Paso 9: verde.** `pnpm --filter api check-types`, `pnpm --filter api test`, `pnpm --filter api test:int` completo en base descartable, `pnpm --filter @repo/schemas test`. Buscar con `grep -rn "unitLocked\|UNIT_IN_USE\|isProductQuoted" apps packages` que no queden usos.
- [ ] **Paso 10:** dejar en staged las rutas tocadas y detenerse; reporte en el archivo que indique el controlador.

---

### Task 2: Web

**Archivos:**
- Modificar: `apps/web/src/features/quotes/types.ts`, `lineHelpers.ts`, `quotes.store.ts` y el estado del cotizador (líneas con `uomId`/`unit`), `components/builder/LineBuilder/LineCard.tsx`, `QuickLineBuilder/QuickLineCard.tsx`, `QuotePreview/index.tsx`, `ProductPicker.tsx` (solo líneas ya existentes), el detalle de cotización si muestra cantidades con unidad, `apps/web/src/features/events/components/detail/ProductSheetHeader.tsx`, `ProductSelectionsSheet.tsx`, `ProductSelectionDetailSheet.tsx`, `apps/web/src/features/catalog/components/ProductForm.tsx`, `ProductFormModal.tsx`, locales `apps/web/src/locales/{es,en}/catalog.json`, pruebas existentes de lo tocado, `docs/frontend/architecture.md`.

**Interfaces:**
- Consume (Task 1): cada línea de cotización y de evento trae `unit` y `uomId`; el envío de líneas admite `uomId` opcional.
- Produce: las líneas existentes reenvían su `uomId` al guardar; las nuevas no lo envían; toda cantidad de una línea se formatea con `formatQuantity(line.quantity, line.unit)`.

- [ ] **Paso 1: pruebas primero (rojo).** Helper de líneas: al cargar una cotización existente cada línea conserva `uomId` y `unit`; una línea nueva no lleva `uomId`; el mapeo a la API envía `uomId` solo en las existentes. Prueba de paridad de locales sigue verde tras quitar las claves de unidad bloqueada.
- [ ] **Paso 2: tipos y estado del cotizador.** Líneas con `unit`/`uomId`; al agregar un producto la línea toma `product.unit` solo para mostrar y no envía `uomId`.
- [ ] **Paso 3: lectores.** Cotizador, vista previa, detalle de cotización y evento muestran `line.unit`. Los tramos y la cantidad mínima del selector de producto siguen usando la unidad actual del producto (spec §4).
- [ ] **Paso 4: formulario de producto.** Quitar `unitLocked` y su texto i18n; el selector de unidad siempre habilitado.
- [ ] **Paso 5: docs.** Nota breve en `docs/frontend/architecture.md`: la unidad de una línea es la de la línea, no la del producto.
- [ ] **Paso 6: verde.** `pnpm --filter web check-types`, `pnpm --filter web test`, y la corrida completa `pnpm check-types` y `pnpm test`; `prettier --check` de lo tocado. No se prueba en vivo: dejar en el reporte qué debe probar el usuario (cambiar la unidad de un producto cotizado y abrir la cotización vieja; editar y guardar esa cotización; cotización nueva con el producto; detalle de evento; móvil).
- [ ] **Paso 7:** dejar en staged las rutas tocadas y detenerse.
