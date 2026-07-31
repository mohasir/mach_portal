# Changelog

Todos los cambios notables de Mach Portal (API) se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto usa [Semantic Versioning](https://semver.org/lang/es/).

## [0.2.0] - 2026-07-31

### Added

- Nuevo filtro `segment` (`upcoming` | `past` | `all`) en el listado de
  `events` (`eventsListQuerySchema`): compara `eventDate` contra la fecha de
  hoy para traer solo eventos futuros/sin fecha, solo pasados, o todos — un
  eje independiente del `status` derivado (upcoming/completed/cancelled).
- Los recursos de cotización (`quoteListItemResource`, `quoteCardResource`,
  `buildQuoteDetail`) exponen ahora `isComplete`, calculado con el mismo
  criterio que `assertReadyToSend` (state + address + city + al menos una
  línea) — permite mostrar en listado, tablero y detalle qué cotizaciones ya
  están listas para pasar a "Enviada" sin duplicar la regla en el front.
- Seed de la plantilla de PDF de cotización (tipo `quote_pdf`, locale `es`):
  agrega servicios, términos y condiciones, nota de vigencia y nota de dietas
  por defecto cuando no existe una fila para ese tipo/locale en `templates`
  (los entornos nuevos dejan de quedar con la plantilla vacía).

### Changed

- El script de seeding (`pnpm db:seed`) ahora requiere el flag
  `--demo=<prod|local>` y separa usuarios admin reales (se siembran siempre)
  de usuarios y datos de demo/prueba — clientes, staff, cotizaciones y
  eventos (solo con `--demo=local`). Actualizar los pipelines que invocan el
  seed para pasar `--demo=prod`.

### Fixed

- Actualizar una cotización (`updateQuote`) ya no fuerza `isDraft` a `false`:
  `updateQuoteSchema` ahora recibe explícitamente ese campo (antes no existía
  en el input), así que editar una cotización en borrador ya no le hace
  perder su estado de borrador.

## [0.1.0] - 2026-07-28

### Added

- Columna `city` en `quotes` y `events`.
- Columna `quotes.longDistanceAmount`: cargo discrecional por cotización (no
  se deriva de una tasa guardada — el staff lo fija libremente por cotización,
  no hay columnas nuevas en `state_settings`).
- `computeQuoteTotals` (paquete `@repo/schemas`, compartido con el front) suma
  ahora el cargo por larga distancia a la base antes de calcular el impuesto.

### Changed

- El PDF de la cotización (`buildFees`) ahora reporta el cargo por larga
  distancia y el impuesto como dos líneas separadas (antes el impuesto se
  reportaba mal etiquetado como "Long Distance Travel Fee").
- `assertReadyToSend` ahora también exige `city` (además de `state` y
  `address`) para poder pasar una cotización a "Enviada".
- `validateLine` ya no exige que `numPersons` coincida con un tramo de precio
  existente del catálogo — permite cantidad/precio personalizados por línea
  (habilitado por la nueva vista rápida de estaciones del builder mobile).
