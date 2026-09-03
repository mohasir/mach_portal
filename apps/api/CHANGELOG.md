# Changelog

Todos los cambios notables de Mach Portal (API) se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto usa [Semantic Versioning](https://semver.org/lang/es/).

## [0.10.0] - 2026-09-02

### Added

- `createdByName` en `quotes.board` (`quoteCardResource`) y en los recursos de
  eventos (`eventListItemResource`, usado por `events.list`/`calendar`/
  `getById`): el nombre de quien creó la cotización de origen. El evento no
  tiene creador propio, se resuelve vía `quotes.createdById`.

## [0.9.0] - 2026-09-02

### Added

- Flujo de configuración de contraseña de usuario (`users.generatePasswordSetupLink`,
  columna `mustChangePassword` en `user`): crear un usuario ya no le fija una
  contraseña utilizable por quien lo crea — Better Auth recibe una contraseña
  aleatoria que se descarta al toque, y se emite un link de un solo uso (token con
  vencimiento de 24h, sobre la propia tabla `verification` de Better Auth) para que
  el usuario fije la suya vía su endpoint nativo de reset. Mientras
  `mustChangePassword` sea `true`, cualquier request autenticado (`protectedProcedure`)
  se rechaza con `USER_MUST_CHANGE_PASSWORD`; al resetear la contraseña, el flag se
  limpia y se revocan las demás sesiones. Nueva variable de entorno requerida
  `WEB_APP_URL` (origen canónico usado para construir el link).
- Scope de permisos `own`/`all` por recurso (`resolveResourceScope`, tipo
  `ResourceGrant` en `@repo/guards`): un rol puede declarar `{ actions, scope: 'own' }`
  en vez de solo un array de acciones — aplicado por ahora a `quote` y `event`
  (filtro por dueño/asignado en los repositorios), en el nuevo rol `operator`
  (reemplaza a `manager`).
- Nueva acción `manage_line_pricing` (recurso `quote`): solo admin/superadmin puede
  guardar una línea con `numPersons`/precio que no coincida con un tramo del
  catálogo; el resto recibe `QUOTE_PRICING_NOT_ALLOWED` si lo intenta con un
  payload armado a mano.
- Nueva acción `manage_staff_assignments` (recurso `event`), separada del `update`
  genérico, para asignar o quitar staff de un evento.
- Endpoint `quotes.assign` (reasignar `assignedToId`, o desasignar con `null`) —
  solo para roles con scope `all` sobre `quote`; un rol con scope propio no puede
  reasignarse cotizaciones a sí mismo ni a otros.
- Endpoint `quotes.checkAvailability`: devuelve las cotizaciones que ya tienen
  evento en la misma fecha/hora. Deliberadamente sin scope de dueño (muestra
  conflictos de cualquier usuario) y no bloquea `create`/`update` — la doble
  reserva está permitida por negocio, esto es solo un aviso para el builder.

### Changed

- `quotes.list`/`getById`/`board`/`generatePdf`/`update`/`updateStage`/`approve`/
  `cancel`/`archive` y `events.list`/`calendar`/`getById`/`registerPayment`/
  `markCompleted`/`assignStaff`/`removeStaff`/`removePaymentAttachment`/
  `updateSelections` ahora filtran o devuelven 404 según el scope del rol que
  llama (antes cualquier rol con el permiso podía operar sobre cualquier fila,
  la restricción solo vivía en la UI).

## [0.8.0] - 2026-08-30

### Added

- Columna `color` en `event_types` (hex, default `#1677ff`), con 15
  presets de marca (`EVENT_TYPE_COLOR_PRESETS` en `@repo/schemas`) y
  validación de hex libre (`hexColor`, nuevo helper compartido en
  `fields.ts`); expuesta en `eventTypeResource` y, para el calendario,
  como `eventTypeColor` en `eventCalendarItemResource`/
  `EventsRepository`.

## [0.7.0] - 2026-08-25

### Added

- `total` en `dashboard.topProducts` (`topProductsTotal` en `DashboardRepository`):
  cuenta todas las cotizaciones confirmadas del mes, no solo las del top N — permite
  calcular la porción de "otros" y los porcentajes de participación en el donut del
  dashboard sin traer el listado completo de productos.

### Changed

- `dashboard.topProducts` devuelve ahora `{ items, total }` en vez de un array plano.

## [0.6.0] - 2026-08-13

### Added

- Módulo `dashboard`: `summary` (eventos, ingresos, cotizaciones y tasa de
  cierre del mes), `quotesByMonth` (conteo de cotizaciones por mes, para la
  gráfica) y `topProducts` (ranking de estaciones más pedidas, de
  cotizaciones Aprobadas del mes por fecha de evento) — a diferencia del
  resto de los módulos, son solo `query` de agregación, sin CRUD ni
  `Paginated`.
- Tres acciones nuevas en el recurso `dashboard` (`view_summary`,
  `view_quotes_chart`, `view_top_products`), que reemplazan el `CRUD`
  genérico que traía antes (no aplicaba a un módulo de solo lectura) y
  permiten ocultar cada bloque del dashboard de forma independiente por rol.
- Seed de cotizaciones ampliado (más cotizaciones de demo, con `createdAt`
  repartido a lo largo del año en vez de la fecha en que corre el seed) para
  que el dashboard tenga datos representativos en `--demo=local`.

## [0.5.0] - 2026-08-12

### Added

- Preferencia `applyTaxByState` en `app_settings`, con endpoint
  `updateTaxPreferences`: activa o desactiva el cálculo de impuesto por
  estado para las cotizaciones; con la preferencia apagada, `QuotesService`
  ignora la tasa del estado y calcula el impuesto en 0.
- Recargo configurable por pago con tarjeta/cheque: columna
  `cardSurchargeRate` en `app_settings` (default 9%) y columnas
  `applyCardSurcharge`/`cardSurchargeRate`/`cardSurchargeAmount` en
  `quotes`. `computeQuoteTotals` (`@repo/schemas`) calcula el recargo sobre
  el total ya con impuesto aplicado, y el PDF de la cotización lo agrega
  como línea de fee ("Card/Check Surcharge (X%)") cuando corresponde.
- Campo `totalPaid` (subquery sobre `eventPayments`) y `paymentStatus`
  derivado (pendiente/parcial/pagado) ahora también en el listado de
  eventos (`eventListItemResource`), no solo en el detalle.

## [0.4.0] - 2026-08-08

### Added

- Módulo de notificaciones (`notifications`): tablas `notifications` y
  `notification_reads`, endpoints `list` (paginado, con soporte de cursor
  para scroll infinito), `unreadCount`, `markRead`, `markAllRead` y
  `dismiss`. La visibilidad por tipo de notificación se resuelve por rol en
  código (`NOTIFICATION_TYPE_ROLES`), no en una columna de la tabla.
- Notificaciones `quote_confirmed` y `quote_cancelled`, creadas al aprobar
  o cancelar una cotización (visibles para Admin, excepto quien hizo la
  acción).
- Cron diario (`node-cron`, 12:00 UTC ≈ 7-8am hora de negocio) que revisa
  los eventos con selecciones de estaciones pendientes
  (`EventsRepository.findPendingSelectionsCandidates`) y crea una
  notificación `event_selections_reminder` cuando quedan 3 días o menos
  para el vencimiento de confirmación (`optionsSelectionDeadlineDays`);
  idempotente por evento (`NotificationsRepository.createIfNotExists`).
  Script `pnpm --filter api jobs:event-reminders` para correrlo a mano.

## [0.3.0] - 2026-08-05

### Added

- Módulo de pagos (`payments`): `list` (listado paginado de pagos de eventos,
  con filtros de rango de fechas, cliente, tipo de evento y método) e
  `income` (ingresos agrupados por semana/mes/año), sobre la tabla existente
  `eventPayments`; nuevo recurso de permisos `PAYMENT`.
- Endpoint `updateEventSelections` para resolver, desde el evento, las
  opciones de cada estación pendientes de elegir: valida que cada línea
  pertenezca a la cotización del evento y que las opciones respeten las
  reglas del grupo de opciones (`validateLineSelections`); rechaza el cambio
  si el evento ya se marcó como completado.
- Nueva acción de permisos `manage_selections` (recurso `event`) para
  controlar quién puede editar las selecciones de un evento.
- Preferencia configurable `optionsSelectionDeadlineDays` (días de margen
  antes del evento para exigir la confirmación de selecciones), expuesta en
  el detalle del evento como `selectionsDeadline`/`selectionsPending`.
- Preferencia configurable `allowSelectOptionsAtQuote` (nuevo recurso de
  permisos `quote_builder_preferences`): define si las opciones de cada
  estación se resuelven al armar la cotización o quedan pendientes para el
  evento.
- Seed de pagos de eventos (`eventPayments`) y datos de demo de cotizaciones
  ampliados, para entornos con `--demo=local`.

### Changed

- `WEB_ORIGIN` ahora acepta una lista separada por comas, para confiar en
  múltiples orígenes (ej. `localhost` + una IP de LAN al probar desde el
  celular) sin dejar de aceptar la configuración anterior de un solo
  origen.

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
