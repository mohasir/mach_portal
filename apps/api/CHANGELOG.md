# Changelog

Todos los cambios notables de Mach Portal (API) se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto usa [Semantic Versioning](https://semver.org/lang/es/).

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
