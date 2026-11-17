# Unidad de medida por línea de cotización — diseño

Fecha: 2026-11-16. Complementa el catálogo genérico (`2026-11-14-catalogo-generico-programa.md`, fase 1).

## 1. Objetivo

Cambiar la unidad de un producto no debe alterar las cotizaciones que ya lo usan. Cada línea de cotización guarda la unidad con la que se cotizó, y el bloqueo actual de cambio de unidad desaparece.

## 2. Decisiones (acordadas con el usuario)

- `quote_lines.uom_id` (NOT NULL, FK a `units_of_measure`) congela la unidad al crear la línea. La migración 0013 lo rellena con la unidad actual del producto de cada línea, así que ninguna cotización existente cambia.
- **Al editar una cotización vieja, la línea conserva su unidad** aunque el producto haya cambiado de unidad. La unidad nueva del producto vale solo para líneas nuevas. Un mismo producto puede verse con dos unidades en cotizaciones distintas.
- Se elimina el bloqueo de unidad del producto: `PRODUCT_UNIT_IN_USE`, `unitLocked` y la comprobación de producto cotizado en `updateProduct`. El selector de unidad queda libre siempre.
- Misma rama `feat/catalogo-generico`; migración 0013 encima de la 0012.

## 3. Datos

- Migración 0013 (drizzle-kit, SQL revisado a mano): `ADD COLUMN uom_id uuid`, `UPDATE quote_lines SET uom_id = products.uom_id FROM products WHERE ...`, `SET NOT NULL`, FK a `units_of_measure(id)` e índice `(tenant_id, uom_id)`. `when` estrictamente mayor que el de la 0012 y no futuro (`migrationJournal.test.ts`); `db:generate` no propone nada después.
- RLS no cambia (la tabla ya tiene `tenantIsolationPolicy`).

## 4. API

- `QuoteLineInput` admite `uomId` opcional:
  - Omitido: la línea toma la unidad actual del producto.
  - Presente y distinto de la unidad actual del producto: solo se acepta si ya existe una línea de esa misma cotización y ese mismo producto con esa unidad (así `replaceLines`, que borra y reinserta las líneas, conserva la unidad congelada). Si no, se rechaza con un error de validación.
  - El id se resuelve con lecturas del tenant (receta multi-tenant), nunca solo por la FK.
- `publicQuoteLineColumns` y la lectura de cotización devuelven `unit` (id, name, pluralName, code, dimension) de la línea; los lectores que hoy usan la unidad del producto para una línea (cotizador, vista previa, detalle de evento, payload del PDF) pasan a la de la línea.
- Borrado y desactivación de unidades: una unidad referenciada por líneas de cotización cuenta como "en uso" igual que si la usara un producto.
- Producto: se quita `PRODUCT_UNIT_IN_USE`, `unitLocked` (resource y repositorio, si ya no los usa otra cosa) y `isProductQuoted` para este fin.
- La cantidad mínima y los tramos siguen en la unidad actual del producto; solo afectan a líneas nuevas o editadas.

## 5. Web

- Tipos de cotización y evento incluyen `unit` por línea. Cotizador (tarjetas de línea, vista previa), detalle de cotización y de evento muestran la unidad de la línea.
- El cotizador, al editar una cotización existente, reenvía el `uomId` de cada línea que ya existía; las líneas nuevas no lo envían.
- Formulario de producto: se elimina el estado "unidad bloqueada" y su texto i18n (es/en, con paridad).

## 6. Pruebas

- API: la migración rellena `uom_id` con la unidad del producto; cambiar la unidad del producto no altera las líneas ya guardadas; editar la cotización conserva la unidad congelada; una línea nueva toma la unidad actual; `uomId` ajeno al tenant o sin línea previa que lo respalde se rechaza; una unidad usada solo por líneas no se puede borrar ni desactivar; aislamiento por organización.
- Web: lectores muestran la unidad de la línea; paridad de locales; el formulario de producto ya no bloquea la unidad.
- No se prueba en vivo; el usuario verifica en el navegador.

## 7. Fuera de alcance

- Congelar nombre, precio o tramos del producto en la línea (hoy se leen en vivo; el subtotal ya está guardado).
- Impedir que se edite el nombre, la dimensión o el factor de una unidad ya usada.
- El add-on de unidades de medida (va después y depende de esta regla).
