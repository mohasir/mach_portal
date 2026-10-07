# SDD — Reprogramación de eventos (cambio de fecha y hora)

> Documento de diseño técnico. Estado: **implementado** (plan: `docs/superpowers/plans/2026-10-06-event-reschedule.md`).
> Specs que rigen la implementación: `docs/backend/architecture.md` y `docs/frontend/architecture.md`.

---

## 1. Contexto / Problema

Un evento nace al aprobar la cotización (`quotes.service.ts::approve` → `approveWithEvent`) como
**snapshot** de `eventDate` / `eventTime` / dirección de la quote. Desde ese momento:

- La quote queda **read-only** (`EDITABLE_STAGES`, decisión D13 de `docs/mach-bar-domain.md`).
- El router de eventos no expone ninguna mutación para cambiar fecha u hora.

Resultado: si el cliente mueve el evento, no hay forma de reflejarlo en el sistema, y tampoco queda
registro de cuándo ni por qué se movió.

La fecha del evento alimenta varias piezas, todas afectadas por un cambio:

| Pieza | Dónde | Lee de |
|---|---|---|
| Estado próximo / pasado, alerta "pasó la fecha" | `events.repository.ts` (filtro `gte(events.eventDate, today)`), `EventHeader.tsx` | `events` |
| Calendario (mes / semana / día) | `events.repository.ts::calendar` | `events` |
| Plazo de selecciones y recordatorio | `jobs/eventReminders.job.ts` | `events` |
| Disponibilidad de staff | `staff.repository.ts::findAvailable` | `events` |
| Chequeo de doble reserva | `quotes.repository.ts::findByDateTime` | `quotes` |
| Filtro de cotizaciones por mes / año | `quotes.repository.ts` | `quotes` |
| PDF de la cotización | `quotes.pdf.ts` | `quotes` |

---

## 2. Alcance

### Dentro de alcance

- **Catálogo de motivos de reprogramación**: CRUD nuevo con página propia (ítem de navegación, solo
  superadmin) y resource propio.
- **Acción nueva `RESCHEDULE`** sobre `RESOURCES.EVENT`.
- **Pantalla dedicada de reprogramación** (`/admin/events/[id]/reschedule`), con los mismos inputs de
  fecha y hora que el builder de cotizaciones.
- **Previsualización de conflictos** antes de guardar: staff asignado que choca en la nueva fecha y
  otros eventos en la misma fecha y hora.
- **Mutación de reprogramación**: fecha, hora, motivo obligatorio y nota (obligatoria si el motivo
  lo exige).
- **Sincronización** de la nueva fecha y hora en `events` **y** `quotes`.
- **Histórico de reprogramaciones** en tabla propia, visible para todo rol con acceso al evento
  (permiso `VIEW_RESCHEDULES`).
- **Acción "Reprogramar" en el listado de eventos**, además del botón del detalle.
- **Notificación in-app** a admins.

### Fuera de alcance

- Cambiar dirección, ciudad o estado del evento.
- Desasignar staff automáticamente cuando choca.
- Tag o indicador "Reprogramado" en el evento: el historial alcanza.
- Reprogramar eventos realizados o cancelados.
- Avisar al staff: el staff no es usuario del sistema (tabla `staff` sin login).
- Límite de reprogramaciones por evento: no hay tope.

---

## 3. Diseño — Catálogo de motivos

### 3.1 Modelo de datos

Nueva tabla `reschedule_reasons` (`apps/api/src/db/schema/rescheduleReasons.ts`), con la misma forma
que `event_types`:

```ts
export const rescheduleReasons = pgTable('reschedule_reasons', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  requiresNote: boolean('requires_note').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});
```

- **`requiresNote`** generaliza el caso "Otro": en vez de comparar por nombre, cualquier motivo
  marcado así obliga a llenar la nota. El seed crea "Otro" con `requiresNote = true`.
- **Soft-delete** (`isActive`): las reprogramaciones históricas referencian el motivo, así que no se
  borra. Los inactivos no aparecen en el select del formulario, pero sí se muestran en el historial.

Seed inicial: Solicitado por el cliente, Clima, Otro (`requiresNote`).

### 3.2 Permisos (`@repo/guards`)

- `RESOURCES.RESCHEDULE_REASON = 'reschedule_reason'`, con `[VIEW, ...CRUD]` en
  `permissions.matrix.ts`.
- `rolesPermissionsMatrix`:

| Rol | Grant |
|---|---|
| superadmin | `VIEW` + `CRUD` |
| admin | `READ` |
| operator | — |
| member | — |

Las dos acciones de lectura se separan:

- **`VIEW`** gatea la página del catálogo (ítem de navegación + route-access). Solo superadmin.
- **`READ`** gatea el endpoint `list`. El admin lo necesita para poblar el `Select` de motivos en la
  pantalla de reprogramación, pero no ve la página ni la entrada en la navegación.

Difiere de `event_types`, cuyo ítem de navegación se gatea con `READ`: acá `READ` sola no alcanza
para ver la página.

### 3.3 API

Módulo `apps/api/src/modules/rescheduleReasons/` (`resource → repository → service → router`), espejo
de `eventTypes`:

- `list` (`READ`) — paginado (`Paginated`), con filtro `isActive`. Lo usan la página del catálogo
  (superadmin) y el `Select` de la pantalla de reprogramación (superadmin y admin).
- `create` (`CREATE`), `update` (`UPDATE`), `toggleActive` (`UPDATE`) — solo superadmin.
- Errores en `ErrorCodes.rescheduleReason` (`NOT_FOUND`, `NAME_TAKEN`).
- Schemas Zod en `packages/schemas/src/rescheduleReasons.ts`.

### 3.4 Web

- Feature `apps/web/src/features/reschedule-reasons/` según `docs/frontend/architecture.md` §4:
  `DataTable` en desktop y **card en móvil** (`mobileRenderType="card"` + `renderCard` con
  `RescheduleReasonCard`), hooks tRPC, `<Can>`, i18n es/en. No se toma `features/event-types/` como
  modelo de tabla: es la única feature que muestra la tabla en móvil (`mobileRenderType="list"`).
- Row actions (`useRescheduleReasonRowActions`, compartidas por columnas y card): copiar id, editar y
  activar / desactivar, con la convención de soft-delete del catálogo: `TbTrashFilled` (desactivar,
  `danger`) y `TbRestore` (reactivar), `size={16}`. Desactivar pide confirmación
  (`confirm` de la row action):
  - Título: *¿Desactivar «{nombre}»?*
  - Contenido: *Dejará de aparecer al reprogramar eventos.*
  - Caption: *Las reprogramaciones que ya lo usan lo seguirán mostrando.*
- Ruta `apps/web/src/app/admin/reschedule-reasons/` e ítem de navegación propio
  (`RESCHEDULE_REASONS_ITEM` en `lib/navigation/constants/items.ts`, en el grupo de catálogo junto a
  `EVENT_TYPES`), gateado por `RESCHEDULE_REASON:VIEW`. El mismo guard protege la ruta
  (route-access).

---

## 4. Diseño — Reprogramación

### 4.1 Modelo de datos

Nueva tabla `event_reschedules` en `apps/api/src/db/schema/events.ts`:

```ts
export const eventReschedules = pgTable('event_reschedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => events.id, { onDelete: 'cascade' }),
  fromDate: date('from_date', { mode: 'string' }),
  fromTime: text('from_time'),
  toDate: date('to_date', { mode: 'string' }).notNull(),
  toTime: text('to_time'),
  reasonId: uuid('reason_id')
    .notNull()
    .references(() => rescheduleReasons.id),
  note: text('note'),
  // Staff that clashed on the new date when it was saved, kept for audit.
  staffConflicts: jsonb('staff_conflicts').notNull().default([]),
  rescheduledById: text('rescheduled_by_id').references(() => user.id, { onDelete: 'set null' }),
  rescheduledAt: timestamp('rescheduled_at').defaultNow().notNull(),
});
```

- `fromDate` / `fromTime` son nullable porque `events.eventDate` / `eventTime` lo son.
- `staffConflicts` guarda `{ staffId, name }[]`: deja constancia de que se guardó **sabiendo** que
  había choques.
- Además se inserta una fila en `event_history` con `type: 'rescheduled'` para que aparezca en el log
  de actividad existente.

### 4.2 Excepción a "quote read-only" (D13)

La reprogramación actualiza `quotes.eventDate` / `quotes.eventTime` en la misma transacción. Es la
**única** escritura permitida sobre una quote Aprobada: solo esos dos campos y solo por este flujo,
nunca precios ni líneas. La fecha original queda en `event_reschedules`, así que no se pierde
historia.

Efectos automáticos de esa escritura:

- `quotes.updatedAt` se actualiza (`$onUpdate`) → `QuoteDetailPage` marca el PDF como **stale**
  (`isAfter(updatedAt, pdfGeneratedAt)`) y se regenera con la fecha nueva. No hace falta invalidación
  manual.
- El chequeo de doble reserva y el filtro de cotizaciones por mes / año ven la fecha nueva.

Agregar esta excepción como decisión nueva en `docs/mach-bar-domain.md`.

### 4.3 Permisos (`@repo/guards`)

- `ACTIONS.RESCHEDULE = 'reschedule'`, agregada a `RESOURCES.EVENT` en `permissions.matrix.ts`.
- `EVENT_FULL` pasa a incluir `RESCHEDULE` → superadmin y admin.
- Operator **no** la recibe, ni siquiera con scope `own`.
- `ACTIONS.VIEW_RESCHEDULES = 'view_reschedules'`, también en `RESOURCES.EVENT`: gatea el histórico
  de reprogramaciones, separado de `RESCHEDULE` (puede verlo quien no reprograma). Lo reciben
  superadmin y admin (vía `EVENT_FULL`) y operator (con su scope `own`, así que solo para sus eventos).
- El log de actividad general (`history`) **no cambia**: sigue siendo solo superadmin.

### 4.4 Reglas de negocio

1. Solo eventos **próximos**: rechazar si `completedAt` no es null o si la quote está cancelada
   (`ErrorCodes.event.NOT_RESCHEDULABLE`). Una quote archivada responde `EVENT_NOT_FOUND`, como el
   resto de mutaciones de eventos (`isAccessible`).
2. Se permite reprogramar un evento cuya fecha ya pasó pero que no se marcó como realizado.
3. La nueva fecha no puede ser pasada (`ErrorCodes.event.DATE_IN_PAST`).
4. La nueva fecha / hora debe ser distinta de la actual (`ErrorCodes.event.SAME_SCHEDULE`). Se puede
   cambiar solo la hora.
5. `reasonId` obligatorio y debe estar activo (`ErrorCodes.rescheduleReason.INACTIVE`).
6. Si el motivo tiene `requiresNote`, la nota es obligatoria (`ErrorCodes.event.NOTE_REQUIRED`).
   Validado en el service, no solo en el formulario.
7. Los conflictos **no bloquean**: el server los recalcula al guardar y los persiste en
   `staffConflicts`.
8. Scope `own`: aplica `ownerScope(ctx)` como el resto de mutaciones de eventos.
9. Sin límite de reprogramaciones por evento.

### 4.5 Conflictos de staff

**Definición**: un miembro del staff asignado a este evento choca si también está asignado a **otro**
evento en la nueva fecha que no está cancelado ni archivado.

La disponibilidad hoy es **por día**, no por hora (`staff.repository.ts::findAvailable`); se mantiene
ese criterio. Hoy `findAvailable` solo excluye las cotizaciones archivadas, así que un evento
cancelado (no archivado) deja al staff como no disponible. Para que las dos consultas no se
contradigan, la condición "staff ocupado ese día" se extrae a un helper compartido
(cotización no archivada **y** evento no cancelado) y la usan `findAvailable` y `findStaffConflicts`.

Repositorio: `EventsRepository.findStaffConflicts(eventId, date)` devuelve
`{ staffId, name, conflictingEvent: { id, quoteNumber, eventTime } }[]`.

### 4.6 API

En `events.router.ts`:

```ts
checkReschedule: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] })
  .input(checkRescheduleSchema)          // { eventId, eventDate, eventTime? }
  .query(...)                            // { staffConflicts, eventConflicts }

reschedule: guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] })
  .input(rescheduleEventSchema)          // { eventId, eventDate, eventTime?, reasonId, note? }
  .mutation(...)
```

- `checkReschedule` combina `findStaffConflicts` + el chequeo de doble reserva que ya usa el builder
  (`quotes.service.ts::checkAvailability` → `quotesRepo.findByDateTime(date, time, quoteId)`), sin
  duplicar esa lógica. `findByDateTime` exige la hora (filtra por `eventTime`), y la hora es
  opcional: sin hora, `eventConflicts` se calcula por fecha (`quotesRepo.findByDate(date, quoteId)`,
  nuevo), así el aviso de doble reserva no queda vacío solo porque falte la hora.
- `reschedule`, en una transacción (`EventsRepository.reschedule`):
  1. `UPDATE events SET event_date, event_time`.
  2. `UPDATE quotes SET event_date, event_time` (por `events.quoteId`).
  3. `INSERT event_reschedules`.
  4. `INSERT event_history` (`type: 'rescheduled'`, `data: { from, to, reasonName }`).
  5. `DELETE` de la notificación `event_selections_reminder` del evento. El job
     (`eventReminders.job.ts`) deduplica con `createIfNotExists` por `(type, entityId)`: si el
     recordatorio ya salió con la fecha vieja, nunca crearía uno nuevo, y el feed seguiría
     mostrando el plazo viejo. Al borrarlo, el próximo cron lo recrea con la fecha nueva.
- Notificación: después de la transacción (ver §4.7).
- `getById` suma `reschedules` (con `reasonName` y `rescheduledByName`), `null` sin
  `EVENT:VIEW_RESCHEDULES`.

Schemas Zod en `packages/schemas/src/events.ts`.

### 4.7 Notificaciones

- **Admins (in-app)**: nuevo `NotificationType` `'event_rescheduled'` en `notifications.resource.ts`,
  con audiencia `[ROLES.ADMIN]` en `NOTIFICATION_TYPE_ROLES` y `excludedUserId` = quien reprograma.
  ```ts
  type EventRescheduledData = {
    quoteNumber: string;
    clientName: string;
    fromDate: string | null;
    toDate: string;
    toTime: string | null;
  } & NotificationVisualData;   // source: 'user'
  ```
  Requiere su render en `features/notifications` y las claves i18n.
- **Staff**: no se notifica (no es usuario del sistema).

### 4.8 Web

En `features/events/`:

- **Puntos de entrada**, ambos visibles solo en eventos próximos y gateados por `EVENT:RESCHEDULE`;
  icono `TbCalendarRepeat` (Tabler vía `react-icons/tb`):
  - Botón "Reprogramar" en la card del encabezado de `EventHeader.tsx`, junto a "Marcar realizado".
  - Row action "Reprogramar" en el listado (`useEventRowActions`, tabla y card móvil). Navega con
    `?returnTo=<ruta actual>` para volver al listado y no al detalle.
- **Pantalla `RescheduleEventPage`** en `apps/web/src/app/admin/events/[id]/reschedule/page.tsx`:
  - Ruta gateada por `EVENT:RESCHEDULE`: `route-access.ts` tiene `ROUTE_PATTERNS` para rutas con
    segmento dinámico (sin él heredaría `EVENT:READ` de `/admin/events`), y la página muestra
    `AccessDenied` si falta el permiso. Si el evento no es reprogramable (realizado o cancelado),
    redirige al detalle.
  - Vuelta (guardar, cancelar, flecha atrás): a `returnTo` si es una ruta `/admin` o `/admin/…`
    (cualquier otro valor se ignora para no abrir un redirect a otro sitio); si no, al detalle.
  - Layout mobile-first en una columna: card de resumen (cliente, número de cotización, fecha / hora
    actuales) y card del formulario.
  - **Botones Cancelar / Guardar**: en móvil, barra fija abajo como el quote builder
    (`fixed inset-x-0 bottom-0 z-10 border-t bg-white p-3`, página con `pb-24`); en desktop, al pie
    del formulario. **Guardar queda deshabilitado mientras fecha y hora sean las actuales**
    (`isSameSchedule` en `features/events/helpers.ts`, espejo de `SAME_SCHEDULE`); en ese estado
    tampoco se consulta `checkReschedule`.
- **Campos del formulario**:
  - Fecha y hora con **los mismos inputs del builder de cotizaciones**: `WrapperDatePicker` y
    `WrapperTimePicker` con `sheetTitle`, `minuteStep={15}`, `disabledPastDate` / `disabledPastTime`
    (helper compartido en `src/lib/date`, también usado por `EventSection`), y feedback
    `hasFeedback` / `validateStatus` (validando → warning si hay conflictos → check si no).
    Precargados con los valores actuales. Si la hora guardada es texto libre que no parsea como
    `HH:mm`, el picker queda vacío y se muestra un aviso: guardar sin elegir hora la borra.
  - Motivo (`Select` con motivos activos en orden de catálogo, vía `rescheduleReasons.list` con
    `READ`, solo si hay permiso). **Preseleccionado el primero** (`sortOrder`; con el seed,
    "Solicitado por el cliente").
  - Nota (`TextArea`, máx. 500), obligatoria si el motivo tiene `requiresNote`.
- **Previsualización de conflictos**: al cambiar fecha / hora se llama a `checkReschedule` con
  debounce de 400 ms. Los avisos van **dentro del formulario, debajo de fecha y hora**, y solo si hay
  conflictos (sin conflictos alcanza con el check de los campos):
  - Staff — título *Personal no disponible*, texto *El siguiente personal ya tiene otro evento
    asignado en este horario:* y una fila por choque: **Kevin Zhang**: 12:00 pm (000014 ↗). Los
    6 dígitos finales del número de cotización son un link (pestaña nueva, `TbExternalLink`) al
    detalle del otro evento en la pestaña Staff (`/admin/events/<id>?tab=staff`; el detalle acepta
    `?tab=` y lo ignora si la pestaña no existe o no está permitida).
  - Otros eventos en la misma fecha (y hora, si se eligió).
- **Confirmación al guardar**, solo si hay conflictos de staff (`useConfirmModal` en móvil,
  `modal.confirm` en desktop). La decisión se toma con un `checkReschedule` fresco para los valores
  que se guardan (`useFetchRescheduleCheck`), no con la previsualización, que puede estar
  desfasada por el debounce:
  - Título: *¿Guardar cambios con conflicto de horario?*
  - Contenido: *Algunos miembros del equipo ya tienen otros eventos asignados en ese día. Si
    continúas, se reprogramará el evento pero se mantendrán las asignaciones cruzadas.*
  - Botón: *Guardar igual*.
- **Historial**: card propia `EventReschedulesCard` en el detalle (fecha anterior → nueva, motivo,
  nota, staff en conflicto, quién y cuándo), visible con `EVENT:VIEW_RESCHEDULES` e independiente
  de `EventHistoryCard` (log general, solo superadmin, que suma la línea "reprogramó el evento al…").
- Hooks en `features/events/hooks/useReschedule.ts`: `useCheckReschedule`, `useFetchRescheduleCheck`,
  `useRescheduleEvent`. Al guardar invalida `events.*`, `quotes.*` (lista, detalle, doble reserva) y
  `staff.getAvailability`.
- i18n es/en en `locales/*/events.json`. Fechas con `useDateFormatter`.

---

## 5. Decisiones de diseño (resumen)

| # | Decisión | Por qué |
|---|---|---|
| R1 | La fecha nueva se sincroniza en `events` **y** `quotes` | Una sola fecha visible en todo el sistema (calendario, doble reserva, filtros, PDF). |
| R2 | Histórico en tabla propia `event_reschedules` | El motivo es un FK consultable; guarda la fecha original, lo que hace segura la sincronización de R1. |
| R3 | También se escribe en `event_history` | El log de actividad existente muestra todo lo que le pasó al evento en un solo lugar. |
| R4 | Motivos como catálogo con `requiresNote` | Evita comparar por nombre ("Otro") y permite más motivos que exijan nota. |
| R5 | Acción `RESCHEDULE` separada de `UPDATE` | Permite dar o quitar la capacidad de reprogramar sin tocar el resto de permisos del evento. |
| R6 | Conflictos de staff no bloquean, pero exigen confirmación y quedan registrados | El choque puede ser intencional (staff que cubre dos eventos el mismo día). |
| R7 | Disponibilidad de staff por día, con un solo criterio de "ocupado" | Los eventos no tienen hora de fin; `findAvailable` y los conflictos comparten la condición para no contradecirse. |
| R8 | Historial de reprogramaciones visible para todo rol con acceso al evento, con permiso propio `VIEW_RESCHEDULES` | Ver no implica poder reprogramar; el log general sigue solo para superadmin. |
| R9 | Catálogo de motivos: `VIEW` gatea la página, `READ` el listado | El admin elige motivos al reprogramar sin poder ver ni administrar el catálogo. |
| R10 | Reprogramación en pantalla propia, no en sheet / modal | Formulario + previsualización de conflictos necesitan espacio, sobre todo en móvil. |
| R11 | Mismos pickers y reglas de fecha / hora que el builder | Una sola experiencia y una sola regla de "fecha / hora válida" en toda la app. |
| R12 | Guardar deshabilitado sin cambio de fecha / hora | Evita una llamada que el server rechazaría (`SAME_SCHEDULE`). |
| R13 | Motivo por defecto = primero del catálogo, no por nombre | Igual que R4: comparar por nombre se rompe al renombrar. |

---

## 6. Decisiones cerradas

1. **Staff**: no se le avisa. No es usuario del sistema.
2. **Operator**: no puede reprogramar, ni sus propios eventos; sí ve el historial de
   reprogramaciones de sus eventos.
3. **Límite de reprogramaciones**: sin límite.
4. **CRUD de motivos**: solo superadmin. El admin solo lee el listado desde la pantalla de
   reprogramación (ver §3.2).
5. **Catálogo de motivos**: ítem de navegación propio.

---

## 7. Plan de verificación

**Automático**: `pnpm test` (Vitest: reglas de `EventsService.reschedule` / `checkReschedule`,
`RescheduleReasonsService`, permisos, pickers, `route-access`, `isSameSchedule`) y
`pnpm check-types`.

**Manual (móvil primero, después desktop):**

1. Catálogo (superadmin): crear, editar, desactivar (con confirmación) y reactivar motivos; nombre
   duplicado rechazado; en móvil se ve como cards. Admin y operator no ven el ítem de navegación y la ruta los rechaza; el admin sí ve
   los motivos activos en el `Select` de la pantalla de reprogramación.
2. Reprogramar un evento próximo sin staff → fecha nueva en el detalle, el calendario, la lista y la
   cotización; el PDF aparece como desactualizado.
3. Cambiar solo la hora.
4. Motivo "Otro" sin nota → error; con nota → guarda.
5. Evento con staff que tiene otro evento en la fecha nueva → alerta no bloqueante → confirmación →
   guarda; `staffConflicts` registrado.
6. Fecha pasada → rechazada. Evento realizado o cancelado → botón oculto y API rechaza.
7. Evento con la fecha vencida y no realizado → se puede reprogramar; la alerta "pasó la fecha"
   desaparece.
8. Superadmin, admin y operator (en sus eventos) ven la card "Reprogramaciones"; el historial
   general sigue solo para superadmin.
9. Admins (excepto quien reprogramó) reciben la notificación `event_rescheduled`.
10. Evento con selecciones pendientes y recordatorio ya enviado → tras reprogramar, el recordatorio
    viejo desaparece del feed y el cron crea uno nuevo con el plazo de la fecha nueva.
11. Reprogramar sin hora a una fecha con otra reserva → aparece el aviso de doble reserva.
12. Staff con un evento cancelado (no archivado) en la fecha nueva → no figura como conflicto y sí
    como disponible en la asignación.
13. Pickers: días pasados deshabilitados; con la fecha de hoy, horas pasadas deshabilitadas; pasos
    de 15 min; en móvil abren como sheet, igual que en el builder. El builder sigue igual tras
    extraer `disabledDate` / `disabledTime`.
14. Entrar por URL a `/admin/events/[id]/reschedule` de un evento realizado o cancelado → redirige
    al detalle; como operator → sin acceso.
15. Sin cambiar fecha ni hora → Guardar deshabilitado y sin checks de conflicto.
16. Desde el listado de eventos → acción "Reprogramar" → guardar o cancelar vuelve al listado.
17. Link del número de cotización en la alerta de staff → abre el otro evento en la pestaña Staff,
    en otra pestaña del navegador.
18. Tras reprogramar, la lista de cotizaciones y la disponibilidad de staff muestran la fecha nueva
    sin recargar.

---

## 8. Archivos afectados (referencia)

**Packages**
- `packages/guards/src/constants/actions.ts` — `RESCHEDULE`, `VIEW_RESCHEDULES`.
- `packages/guards/src/constants/resources.ts` — `RESCHEDULE_REASON`.
- `packages/guards/src/mappings/permissions.matrix.ts`, `rolesPermissions.matrix.ts`.
- `packages/schemas/src/rescheduleReasons.ts` (nuevo), `packages/schemas/src/events.ts`,
  `packages/schemas/src/index.ts`.

**API**
- `apps/api/src/db/schema/rescheduleReasons.ts` (nuevo), `events.ts`, `index.ts` (`db:push`).
- `apps/api/src/db/seeds/` — seed de motivos.
- `apps/api/src/modules/rescheduleReasons/` (nuevo).
- `apps/api/src/modules/events/events.{router,service,repository,resource,controller}.ts`.
- `apps/api/src/modules/staff/staff.availability.ts` (nuevo, `staffBusyOnDate`), `staff.repository.ts`.
- `apps/api/src/modules/quotes/quotes.repository.ts` — `findByDate`.
- `apps/api/src/modules/notifications/notifications.resource.ts`.
- `apps/api/src/core/trpc/router.ts` — registrar `rescheduleReasons`.
- Error codes (`ErrorCodes.event`, `ErrorCodes.rescheduleReason`).

**Web**
- `apps/web/src/features/reschedule-reasons/` (nuevo) + `app/admin/reschedule-reasons/`.
- `apps/web/src/features/events/components/detail/` — `EventHeader.tsx`, `EventHistoryCard.tsx`,
  `EventReschedulesCard.tsx` (nuevo), `EventDetailPage.tsx` (`?tab=`).
- `apps/web/src/features/events/components/reschedule/` (nuevo) — `RescheduleEventPage.tsx`,
  `RescheduleConflicts.tsx`.
- `apps/web/src/features/events/hooks/useReschedule.ts` (nuevo), `useEventRowActions.tsx`,
  `helpers.ts` (`isSameSchedule`).
- `apps/web/src/app/admin/events/[id]/reschedule/page.tsx` (nuevo), `[id]/page.tsx` (`?tab=`).
- `apps/web/src/lib/auth/route-access.ts` — `ROUTE_PATTERNS`.
- `apps/web/src/lib/hooks/useDebouncedValue.ts` (nuevo).
- `apps/web/src/features/quotes/components/builder/EventSection.tsx` — usar el helper extraído.
- `apps/web/src/lib/date/` — helper compartido `disabledPastDate` / `disabledPastTime`.
- `apps/web/src/features/notifications/` — render de `event_rescheduled`.
- `apps/web/src/lib/navigation/constants/items.ts`, `config.ts`, `icons.tsx` — ítem
  `RESCHEDULE_REASONS` (`TbCalendarTime`).
- `apps/web/src/locales/{es,en}/` — `events.json`, `notifications`, catálogo de motivos.

**Tests (Vitest, nuevo)**
- `apps/api/vitest.config.ts`, `apps/api/src/test/setup.ts`, `apps/web/vitest.config.ts`, script
  `test` en ambas apps y en la raíz (`turbo run test`).
- `*.test.ts` junto al código: `events.service.reschedule`, `events.permissions`,
  `rescheduleReasons.service`, `lib/utils/date`, `lib/date/pickers`, `lib/auth/route-access`,
  `features/events/helpers`.

**Docs**
- `docs/mach-bar-domain.md` — D19, excepción a D13.
