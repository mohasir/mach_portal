# Impuesto por línea y cargos adicionales — diseño

Fecha: 2026-11-16. Fase 2 del programa de catálogo genérico (`2026-11-14-catalogo-generico-programa.md`). Rama `feat/impuesto-por-linea`, desde `multitenant`.

## 1. Objetivo

El impuesto deja de depender del estado del cliente y de una tasa única por cotización. Cada producto lleva su tasa (o es exento), cada línea congela la tasa con la que se cotizó y los totales se calculan por línea. Los cargos que hoy son columnas del cliente original (larga distancia, recargo por tarjeta) pasan a un catálogo de cargos adicionales por organización, detrás de un add-on.

## 2. Decisiones (acordadas con el usuario)

- El impuesto vive solo en el producto y en la línea. La organización define una **tasa por defecto** en Ajustes; al crear un producto el campo se prellena con ella y el admin puede cambiarla. Un producto **exento** cotiza a 0%.
- **Se elimina por completo** el impuesto por estado: `applyTaxByState`, la tabla `state_settings` y la tasa por estado de la configuración. El campo `state` de la cotización **no se toca** (lo reemplaza la fase 3).
- La línea guarda su tasa congelada. Cambiar la tasa de un producto o de la organización solo afecta líneas nuevas o editadas.
- Se elimina el aviso de tasas desactualizadas (`promptRateChanges`, `quoteRateDrift`, `declinedRates`, la resolución de aviso en API y web).
- **Cargos adicionales:** add-on `extraCharges`. Catálogo por organización (nombre, fijo o porcentaje, valor por defecto, activo, orden); en cada cotización se activan y se ajusta el valor. Larga distancia y recargo por tarjeta pasan a ser cargos de ese catálogo. Los cargos **no pagan impuesto** y se aplican sobre el total, no por línea.
- Un cargo en porcentaje se calcula sobre el **total con impuesto**, cada uno independiente, sin componerse entre sí (como hace hoy el recargo por tarjeta).
- El descuento de la cotización se **reparte proporcionalmente entre las líneas** para el impuesto; el resto de centavos va por mayor residuo.
- El vendedor no edita la tasa de una línea: se copia del producto al cotizar. Etiqueta genérica "Impuesto", sin nombre configurable por organización.
- El anticipo (`depositRate`) no cambia: tasa × total.

## 3. Datos

Dos migraciones (drizzle-kit, SQL revisado a mano; `when` estrictamente creciente y no futuro; `db:generate` no propone nada después; RLS como el resto de tablas del tenant): **0014** impuesto por línea y **0015** cargos adicionales.

### 3.1 Migración 0014 — impuesto por línea

- **`app_settings`:** agrega `default_tax_rate` (numeric(6,5), no nulo, default 0; misma precisión que `quotes.tax_rate`). Relleno: la tasa de la cotización más reciente de la organización con tasa mayor que 0 (un borrador sin estado guardado al 0% no cuenta), 0 si no tiene ninguna. Quita `apply_tax_by_state` y `prompt_rate_changes`. Se elimina la tabla `state_settings`.
- **`products`:** agrega `tax_rate` (numeric(6,5), no nulo) y `tax_exempt` (boolean, default false). Relleno: la tasa por defecto de la organización de ese momento.
- **`quote_lines`:** agrega `tax_rate` (numeric(6,5), no nulo) y `tax_amount` (integer, no nulo). Relleno: `tax_rate` = tasa de su cotización; `tax_amount` = el impuesto que le corresponde (ver §7).
- **`quotes`:** quita `tax_rate` y `declined_rates`; conserva `tax_amount`, `total`, `deposit_*`, `state`, y por ahora `long_distance_amount` y las columnas del recargo por tarjeta (pasan en la 0015).
- La migración lleva su prueba (relleno correcto, totales guardados intactos) y la entrada en `verifyMultitenant`.

### 3.2 Migración 0015 — cargos adicionales

- **`charge_types`** (add-on): `id`, `tenant_id`, `name`, `kind` (`fixed` | `percent`), `default_value` (centavos o numeric según `kind`), `is_active`, `sort_order`. Nombre único por organización.
- **`quote_charges`:** `id`, `tenant_id`, `quote_id` (cascade), `charge_type_id` (nullable, `ON DELETE SET NULL`), `name`, `kind`, `value`, `amount` (integer). Los cuatro últimos son copia al cotizar.
- **`quotes`:** quita `long_distance_amount`, `apply_card_surcharge`, `card_surcharge_rate` y `card_surcharge_amount`. **`app_settings`:** quita `card_surcharge_rate` (su valor pasa a ser el valor por defecto del cargo migrado). Ver §7 para los datos existentes.
- La migración lleva su prueba y las entradas en `verifyMultitenant` para las nuevas FKs.

## 4. Cálculo (`computeQuoteTotals`, compartido web ↔ API ↔ PDF)

1. Neto de cada línea (`subtotal`).
2. Descuento fijo o en porcentaje sobre la suma de netos, repartido en proporción al neto de cada línea; el resto por mayor residuo (suma exacta).
3. Impuesto: por cada tasa, `round(Σ (neto − descuento asignado) × tasa)` sobre sus líneas, repartido entre ellas por mayor residuo; 0 si son exentas. Así una cotización con una sola tasa da exactamente lo mismo que la fórmula anterior y la suma de los impuestos de línea es exacta.
4. Total con impuesto = suma de (neto − descuento) + suma de `taxAmount`.
5. Cargos: fijos suman su valor; de porcentaje = `round(total con impuesto × tasa)`, cada uno sobre el mismo total.
6. Total = total con impuesto + cargos. Anticipo = `round(total × depositRate)`.

El resultado expone el desglose por tasa (tasa → base e impuesto) para el PDF y el cotizador.

## 5. API

- Módulo de **configuración:** lee y escribe `default_tax_rate`; se quitan los campos de impuesto por estado y su aviso.
- Módulo de **productos:** `taxRate` y `taxExempt` en crear, actualizar, duplicar y en el recurso. Sin `taxRate` al crear, toma la tasa por defecto de la organización; exento fuerza 0 al cotizar.
- Módulo de **cotizaciones:** al crear o editar una línea copia la tasa vigente del producto (0 si exento); una línea reenviada sin cambios conserva la suya, con la misma lógica de línea congelada que la unidad. Los cargos aplicados se validan contra el catálogo del tenant (ids resueltos con lecturas del tenant) y exigen el add-on `extraCharges`.
- Nuevo módulo **`chargeTypes`** (resource → repository → service → router), con permisos propios (leer, crear, editar, activar/desactivar) y `requireFeature('extraCharges')` en las mutaciones; las lecturas siguen abiertas.
- PDF: el payload lleva impuesto por línea o desglose por tasa y los cargos aplicados.

## 6. Web

- **Ajustes:** tasa por defecto; con el add-on, pantalla de cargos (catálogo). Se quita la configuración de impuesto por estado y el diálogo del aviso de tasas desactualizadas.
- **Producto:** campo de tasa (prellenado con la de la organización) y interruptor de exento en el formulario y en el detalle.
- **Cotizador:** resumen con impuesto por línea o por tasa; la sección de cargos extra aparece solo con el add-on, con los cargos del catálogo activables y con valor ajustable.
- Textos i18n es/en con paridad; mobile-first; sin hex ni estilos en línea.

## 7. Cotizaciones existentes

- Cada línea hereda la tasa de su cotización; `tax_amount` de línea se obtiene repartiendo el `tax_amount` ya guardado de la cotización entre sus líneas con el mismo criterio del cálculo.
- **Los totales ya guardados no se recalculan.** Solo cambian si alguien edita la cotización.
- Larga distancia y recargo por tarjeta se convierten en cargos solo en las organizaciones con alguna cotización que los use: se crean los tipos "Larga distancia" (fijo) y "Recargo por tarjeta" (porcentaje, con la tasa de la configuración) y las cotizaciones afectadas reciben su `quote_charges` con el monto guardado.
- Una organización sin cargos usados no recibe el add-on automáticamente; en el relleno de organizaciones existentes se activa `extraCharges` solo si hubo cargos migrados.

## 8. Pruebas

- API: cálculo por línea (exentas, tasas mixtas, descuento repartido con resto, cargos fijos y porcentaje, anticipo); migración 0014; línea congelada al cambiar la tasa del producto; cargo de otro tenant o sin add-on rechazado; aislamiento por organización en `charge_types` y `quote_charges`.
- Web: cálculo compartido idéntico al de la API, formulario de producto, paridad de locales; no se prueba en vivo.
- El usuario verifica en el navegador (cotización con tasas mixtas, producto exento, cargos con y sin add-on).

## 9. Fuera de alcance

- Nombre del impuesto configurable por organización y tasas compuestas.
- Edición de la tasa por línea en el cotizador.
- Reemplazo del campo `state` (fase 3) y migración de datos del cliente original.
- Impuesto sobre los cargos adicionales.

## 10. Rama

`feat/impuesto-por-linea`, creada desde `multitenant`. Integración con merge (`--no-ff`) cuando el usuario lo pida.
