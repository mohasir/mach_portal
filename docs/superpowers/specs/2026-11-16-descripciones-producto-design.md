# Descripciones de producto con texto enriquecido — diseño

Fecha: 2026-11-16. Complementa el catálogo genérico (`2026-11-14-catalogo-generico-programa.md`).

## 1. Objetivo

Cada producto tiene una descripción corta y una larga, ambas editables con texto enriquecido, guardadas como Markdown.

## 2. Decisiones (acordadas con el usuario)

- La columna actual `products.description` pasa a `short_description` (renombre, los datos se conservan). Se agrega `long_description` (nullable).
- Ambas se guardan como **Markdown** en columnas `text`. El HTML crudo no se admite: se muestra con `react-markdown` (ya instalado), seguro por diseño.
- Editor: **Tiptap v3** (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/markdown`), con barra propia (AntD + lucide), carga diferida y `immediatelyRender: false`. `react-quill` queda descartado (sin soporte de React 19) y `MDXEditor` por su estilo propio.
- Formato permitido: negrita, cursiva, títulos, listas con viñetas y numeradas, enlaces, citas. Sin colores ni tamaños.
- Límites en la API (`@repo/schemas`): corta ≤ 500 caracteres, larga ≤ 10 000, medidos sobre el Markdown guardado.
- Dónde se muestran (hoy la descripción solo se ve en el detalle del producto y en su formulario; no se agregan lugares nuevos salvo la lista del catálogo):
  - Corta: detalle del producto (formateada) y lista del catálogo (en texto plano, truncada a una línea).
  - Larga: solo detalle y formulario del producto.
  - Cotizador y selectores: sin cambios (no muestran descripción hoy).
  - PDF: sin cambios (el servicio externo no tiene campo para esto).

## 3. Datos

- Migración 0012 (generada por drizzle-kit; `when` estrictamente mayor que 0011 y no futuro, regla de `migrationJournal.test.ts`): `ALTER TABLE products RENAME COLUMN description TO short_description` y `ADD COLUMN long_description text`.
- Sin backfill: el texto simple actual es Markdown válido.
- `db:generate` debe proponer cero cambios después.

## 4. API

- `@repo/schemas`: `shortDescription` (opcional, ≤ 500) y `longDescription` (opcional, ≤ 10 000) en los esquemas de crear y actualizar producto; el valor vacío se guarda como `NULL`.
- Serialización: `shortDescription` en todas las vistas que hoy exponen `description` del producto (admin y público); `longDescription` solo en el detalle del producto y el catálogo de administración. El costo sigue omitido sin permiso (no cambia).
- Las descripciones de opciones (`options.description`) no cambian.
- El helper `markdownToPlainText` vive en la web (`apps/web/src/lib/format/markdown.ts`), porque solo la lista del catálogo lo usa; con pruebas.

## 5. Web

- Componente `RichTextEditor` (feature-sliced, en `components/shared`), controlado por Markdown, con barra mobile-first (iconos lucide, sin estilos en línea ni hex, sin `uppercase`), accesible (etiquetas, teclado), carga diferida.
- Formulario de producto: dos campos, corta (editor compacto) y larga. Claves i18n es/en, con paridad.
- Componente `Markdown` de solo lectura (sobre `react-markdown` + `remark-gfm`, sin HTML crudo; los enlaces abren con `rel="noopener noreferrer"`).
- Los seeds y el demo renombran el campo y agregan contenido de ejemplo a la larga.

## 6. Pruebas

- API: renombre en la migración conserva los datos; límites de largo; vacío → `NULL`; serialización; aislamiento por organización; `costo` sin filtrarse.
- Web: `markdownToPlainText`; ida y vuelta Markdown ↔ editor para los formatos permitidos; el pegado de HTML se limpia a esos formatos; paridad de locales.
- No se prueba en vivo (regla del proyecto): el usuario verifica el editor en el navegador.

## 7. Fuera de alcance

- Mostrar descripciones en el PDF.
- Imágenes, tablas o colores dentro del texto.
- Traducción de las descripciones por idioma.

## 8. Rama

La migración 0012 depende de la fase 1 (0011). Se construye en la misma rama `feat/catalogo-generico`, como trabajo adicional de la fase 1, sin rama nueva.
