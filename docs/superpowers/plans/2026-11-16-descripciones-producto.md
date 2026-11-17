# Descripciones de producto con texto enriquecido: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** que cada producto tenga `shortDescription` y `longDescription`, ambas guardadas como Markdown y editables con un editor de texto enriquecido.

**Arquitectura:** la columna `products.description` se renombra a `short_description` y se agrega `long_description` (migración 0012); los esquemas de `@repo/schemas` validan los largos; la web reemplaza el `TextArea` por un `RichTextEditor` (Tiptap v3, carga diferida) y muestra el Markdown con `react-markdown`, que no admite HTML crudo.

**Stack:** Drizzle + Postgres, zod, Vitest, Next 15 + AntD v6 + Tailwind v4, i18next, `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/markdown` (v3), `react-markdown` + `remark-gfm` (ya instalados).

**Spec:** `docs/superpowers/specs/2026-11-16-descripciones-producto-design.md` (autoridad). Leer también `CLAUDE.md`, `docs/backend/architecture.md`, `docs/frontend/architecture.md` y `docs/frontend/styling-guide.md`.

## Restricciones globales

- Misma rama `feat/catalogo-generico`, encima de la migración 0011. Sin commit, push ni PR sin OK explícito del usuario: cada tarea deja sus archivos en staged con rutas explícitas (nunca `git add -A`) y se detiene. Sin atribución de Claude en commits. No usar `git stash`.
- Comentarios en inglés, solo cuando explican un *porqué* no obvio; nada que dependa de la conversación.
- Backend: `resource → repository → service → router`, repositories `(db, tenantId)` con `tenantEq`; el costo (`cost`) nunca aparece sin el permiso `product_cost` (no cambia en esta tarea).
- Esquema: cambiar el TS, `db:generate`, revisar el SQL, la migración 0012 queda con `when` estrictamente mayor que el de la 0011 y no futuro (lo exige `migrationJournal.test.ts`); luego `db:generate` no debe proponer nada.
- Web: mobile-first, AntD v6 + Tailwind v4, `lucide-react`, sin inline styles, sin hex, sin `uppercase`; textos i18n es/en con claves paralelas.
- **Prohibido** correr `db:migrate`, `db:fresh`, `db:reset`, `db:seed`, `feature:*`, `tenant:*` contra una base real, levantar servidores o abrir el navegador. Las pruebas de integración usan una base descartable propia (nombre `mach_test_*`, se borra al terminar). Nunca leer `.env`.
- Verificación por tarea: `pnpm --filter <paquete> check-types` y `test`; en la API, `test:int` de lo tocado; la última tarea corre todo.

## Foco de revisión

1. **Markdown hostil guardado directo por la API:** `<script>` y enlaces `javascript:` no se ejecutan ni se renderizan como HTML; el componente `Markdown` no activa `rehype-raw`.
2. **Vacío y espacios:** `""` y `"   "` se guardan como `NULL` (no como cadena vacía) en ambos campos.
3. **Límites:** 500 y 10 000 se miden sobre el texto guardado; un texto de 501 o 10 001 caracteres se rechaza, uno de exactamente 500 o 10 000 pasa, también con emojis.
4. **Renombre sin pérdida:** los datos de `description` aparecen en `short_description` tras la migración; duplicar un producto copia ambas.
5. **Pegado de HTML en el editor:** se reduce a los formatos permitidos y no guarda atributos, estilos ni etiquetas desconocidas.

---

### Task 1: Datos, esquemas, API y seeds

**Archivos:**
- Modificar: `apps/api/src/db/schema/catalog.ts`, `packages/schemas/src/catalog.ts`, `apps/api/src/modules/products/products.resource.ts`, `apps/api/src/modules/products/products.repository.ts` (crear, duplicar y actualizar producto; **no** tocar las rutas de opciones), `apps/api/src/db/seeds/catalog.ts`, las pruebas de `apps/api/src/modules/products/test/` y las del seed que citen `description` de producto.
- Crear: `apps/api/drizzle/0012_product_descriptions.sql` (+ snapshot y entrada del journal, generados por drizzle-kit), `apps/api/src/modules/products/test/products.descriptions.int.test.ts`.

**Interfaces:**
- Produce: columnas `products.shortDescription` (`short_description`, text, nullable) y `products.longDescription` (`long_description`, text, nullable); en `@repo/schemas`, `SHORT_DESCRIPTION_MAX = 500` y `LONG_DESCRIPTION_MAX = 10000` y los campos `shortDescription: optionalText(SHORT_DESCRIPTION_MAX)` y `longDescription: optionalText(LONG_DESCRIPTION_MAX)` dentro de `productMutationFields` (reemplazan a `description`); el recurso de producto y el catálogo de administración devuelven `shortDescription` y `longDescription` (nunca `description`). Las opciones (`options.description`) no cambian.
- Consume: `optionalText` de `packages/schemas/src/fields.ts` (vacío o espacios → `undefined` → `NULL`).

- [ ] **Paso 1: pruebas primero (rojo).** En `products.descriptions.int.test.ts`: crear con ambas descripciones y leerlas; vacío y espacios guardan `NULL`; 501 y 10 001 caracteres rechazados, 500 y 10 000 aceptados; actualizar y duplicar conservan ambas; otra organización no ve ni modifica las del tenant (patrón de `products.isolation.int.test.ts`); `cost` sigue ausente sin permiso. En `products.schema.test.ts`: los límites y el recorte de espacios.
- [ ] **Paso 2: esquema Drizzle y `@repo/schemas`.** Renombrar `description` a `shortDescription` y agregar `longDescription` en `catalog.ts`; actualizar `productMutationFields`.
- [ ] **Paso 3: migración 0012.** `pnpm --filter api db:generate`; si drizzle-kit pregunta por el renombre, elegir "rename column"; si propusiera borrar y crear, reescribir el SQL a mano como `ALTER TABLE "products" RENAME COLUMN "description" TO "short_description"` y `ADD COLUMN "long_description" text`. Verificar que `when` cumple la regla del journal y que una segunda corrida de `db:generate` no propone nada. Añadir un caso a la prueba de migración (o prueba nueva): el texto previo queda en `short_description`.
- [ ] **Paso 4: repositorio, recurso y servicio.** Reemplazar `description` por `shortDescription` y `longDescription` en `createProduct`, `duplicateProduct` y `updateProduct` (cada uno `?? null`), y en `publicProductColumns` y las dos serializaciones de producto; corregir cualquier otro lector de `products.description`.
- [ ] **Paso 5: seeds.** Renombrar el campo en `seeds/catalog.ts` y en el demo; dar contenido Markdown de ejemplo a la larga de al menos tres productos neutros (sin nombres atados al cliente original).
- [ ] **Paso 6: verde.** `pnpm --filter api check-types`, `pnpm --filter @repo/schemas test` si existe, `pnpm --filter api test` y `pnpm --filter api test:int` completo en base descartable. Buscar con `grep -rn "products.description\|\.description" apps/api/src/modules/products` que no queden usos del campo viejo en productos.
- [ ] **Paso 7:** dejar en staged las rutas tocadas y detenerse; reporte en el archivo de reporte que indique el controlador.

---

### Task 2: Editor, vista y formulario en la web

**Archivos:**
- Modificar: `apps/web/package.json` (dependencias Tiptap), `apps/web/src/features/catalog/components/ProductForm.tsx`, `ProductFormModal.tsx`, `ProductDetailPage.tsx`, `ProductList.tsx` (o el componente de fila que muestre el producto), `apps/web/src/features/catalog/helpers.ts` y su prueba, `apps/web/src/locales/{es,en}/catalog.json`, `docs/frontend/architecture.md`, `docs/superpowers/runbooks/multitenant-cutover.md` (una nota de la migración 0012), `pnpm-lock.yaml`.
- Crear: `apps/web/src/components/shared/RichTextEditor/` (componente y barra), `apps/web/src/components/shared/Markdown.tsx`, `apps/web/src/lib/format/markdown.ts` y sus pruebas.

**Interfaces:**
- Consume (Task 1): el producto trae `shortDescription` y `longDescription` (`string | null`); los envíos usan los mismos nombres.
- Produce: `RichTextEditor({ value, onChange, maxLength, placeholder, 'aria-label' })` (controlado, Markdown de entrada y salida, carga diferida con `next/dynamic` y `ssr: false`, Tiptap con `immediatelyRender: false`, extensiones restringidas a negrita, cursiva, títulos, listas, enlaces y citas; barra con botones AntD e iconos `lucide-react`, mobile-first); `Markdown({ children })` (solo lectura, `react-markdown` + `remark-gfm`, sin HTML crudo, enlaces con `rel="noopener noreferrer"` y `target="_blank"`); `markdownToPlainText(markdown: string, maxLength?: number): string` (quita la sintaxis y colapsa saltos, trunca con `…`).

- [ ] **Paso 1: dependencias.** Agregar `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/markdown` en la misma versión 3.x vigente a `apps/web/package.json` y actualizar `pnpm-lock.yaml` con `pnpm install --filter web` (única instalación permitida; confirmar que no se tocan otras dependencias).
- [ ] **Paso 2: pruebas primero (rojo) del helper.** `markdownToPlainText`: negrita, listas, enlaces, títulos y citas pierden su sintaxis; saltos colapsados; truncado con `…` en el largo pedido; texto simple intacto; vacío devuelve `''`. Prueba de `helpers.ts`: el mapeo del formulario a la API envía `shortDescription` y `longDescription` (vacío como `undefined`).
- [ ] **Paso 3: helper y mapeo.** Implementar `markdownToPlainText` y actualizar `helpers.ts` (tipo de valores del formulario y conversión); actualizar `ProductFormModal.tsx` para cargar ambos valores existentes.
- [ ] **Paso 4: `Markdown` y `RichTextEditor`.** Ambos con prueba: el editor reduce HTML pegado a los formatos permitidos y emite Markdown estable (ida y vuelta de negrita, cursiva, lista, enlace, título y cita), y respeta `maxLength` mostrando el contador; `Markdown` renderiza `<script>` y `javascript:` como texto o descarta el enlace (Foco de revisión 1).
- [ ] **Paso 5: formulario y detalle.** En `ProductForm.tsx` reemplazar el `TextArea` por dos campos (`shortDescription` con editor compacto y límite 500; `longDescription` con editor alto y límite 10 000); en `ProductDetailPage.tsx` mostrar ambas con `Markdown`; en la lista del catálogo, la corta con `markdownToPlainText(…, 120)` en una línea, solo si existe.
- [ ] **Paso 6: i18n y docs.** Claves paralelas es/en (etiquetas, marcadores, contador, botones de la barra, errores de largo); sin tocar las descripciones de opciones. Una sección breve en `docs/frontend/architecture.md` (`RichTextEditor`, `Markdown`, regla de no guardar HTML) y una nota en el runbook de cutover (migración 0012, renombre sin pérdida).
- [ ] **Paso 7: verde.** `pnpm --filter web check-types`, `pnpm --filter web test`, y la corrida completa `pnpm check-types` y `pnpm test`; `prettier --check` de los archivos tocados. No se prueba el editor en vivo: dejar en el reporte la lista de qué debe probar el usuario en el navegador (editar, pegar desde Word, móvil, enlaces).
- [ ] **Paso 8:** dejar en staged las rutas tocadas y detenerse.
