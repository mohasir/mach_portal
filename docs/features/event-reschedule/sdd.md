# SDD — Reprogramación de eventos (cambio de fecha y hora)

> Documento de diseño técnico. Estado: **propuesto, no implementado**.
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

- **Catálogo de motivos de reprogramación**: CRUD nuevo con página propia y resource propio.
- **Acción nueva `RESCHEDULE`** sobre `RESOURCES.EVENT`.
- **Previsualización de conflictos** antes de guardar: staff asignado que choca en la nueva fecha y
  otros eventos en la misma fecha y hora.
- **Mutación de reprogramación**: fecha, hora, motivo obligatorio y nota (obligatoria si el motivo
  lo exige).
- **Sincronización** de la nueva fecha y hora en `events` **y** `quotes`.
- **Histórico de reprogramaciones** en tabla propia, visible solo para superadmin.
- **Notificación** a admins (in-app) y al staff afectado (ver §6, pregunta abierta 1).

### Fuera de alcance (por ahora)

- Cambiar dirección, ciudad o estado del evento.
- Desasignar staff automáticamente cuando choca.
- Tag o indicador "Reprogramado" en el evento: el historial alcanza.
- Reprogramar eventos realizados o cancelados.

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

Seed inicial sugerido: Solicitud del cliente, Clima, Disponibilidad del local, Disponibilidad de
staff, Otro (`requiresNote`).

### 3.2 Permisos (`@repo/guards`)

- `RESOURCES.RESCHEDULE_REASON = 'reschedule_reason'`, con `CRUD` en `permissions.matrix.ts`.
- `rolesPermissionsMatrix`:

| Rol | Grant |
|---|---|
| superadmin | `CRUD` |
| admin | `CRUD` |
| operator | — |
| member | — |

### 3.3 API

Módulo `apps/api/src/modules/rescheduleReasons/` (`resource → repository → service → router`), espejo
de `eventTypes`:

- `list` (`READ`) — paginado (`Paginated`), con filtro `isActive`.
- `create` (`CREATE`), `update` (`UPDATE`), `toggleActive` (`UPDATE`).
- Errores en `ErrorCodes.rescheduleReason` (`NOT_FOUND`, `NAME_TAKEN`).
- Schemas Zod en `packages/schemas/src/rescheduleReasons.ts`.

### 3.4 Web

- Feature `apps/web/src/features/reschedule-reasons/`, espejo de `features/event-types/`
  (`DataTable` en desktop + card en móvil, hooks tRPC, `<Can>`, i18n es/en).
- Ruta `apps/web/src/app/admin/reschedule-reasons/` y entrada en la navegación, gateada por
  `RESCHEDULE_REASON:READ`.

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
- Operator **no** la recibe (ver §6, pregunta abierta 2).
- El histórico de reprogramaciones se devuelve solo a superadmin, igual que `history` en
  `events.router.ts::getById`.

### 4.4 Reglas de negocio

1. Solo eventos **próximos**: rechazar si `completedAt` no es null o si la quote está cancelada /
   archivada (`ErrorCodes.event.NOT_RESCHEDULABLE`).
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

- `checkReschedule` combina `findStaffConflicts` + `quotesRepo.findByDateTime(date, time, quoteId)`.
  `findByDateTime` exige la hora (filtra por `eventTime`), y la hora es opcional: sin hora,
  `eventConflicts` se calcula por fecha (`quotesRepo.findByDate(date, quoteId)`, nuevo), así el
  aviso de doble reserva no queda vacío solo porque falte la hora.
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
- `getById` suma `reschedules` (con `reasonName` y `rescheduledByName`), `null` si no es superadmin.

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
- **Staff afectado**: pendiente de definición (ver §6, pregunta abierta 1).

### 4.8 Web

En `features/events/`:

- **Botón "Reprogramar"** (`CalendarClock`, lucide) en la card del encabezado de `EventHeader.tsx`,
  junto a "Marcar realizado". Visible si `isUpcoming` y gateado con `<Can>` `EVENT:RESCHEDULE`.
- **`RescheduleEventSheet`**: bottom sheet en móvil y modal en desktop. Campos:
  - Fecha (`DatePicker`, deshabilita días pasados) y hora (`TimePicker`), precargadas con los valores
    actuales.
  - Motivo (`Select` con motivos activos).
  - Nota (`TextArea`), obligatoria si el motivo seleccionado tiene `requiresNote`.
- **Previsualización**: al cambiar fecha / hora se llama a `checkReschedule` (debounce). Si hay
  conflictos se muestra un `WrapperAlert` **no bloqueante** con la lista de staff que choca (y el
  evento con el que choca), y aparte los eventos en la misma fecha y hora.
- **Confirmación al guardar**, solo si hay conflictos de staff (`useConfirmModal` en móvil,
  `modal.confirm` en desktop):
  > *La fecha presenta conflictos con miembros del staff. ¿Estás seguro de guardar en esta fecha?*
- **Historial**: sección "Reprogramaciones" en `EventHistoryCard` (solo superadmin), con fecha
  anterior → nueva, motivo, nota, quién y cuándo.
- Hooks: `useRescheduleEvent`, `useCheckReschedule` en `features/events/hooks/`. Invalidar
  `events.getById`, `events.list`, `events.calendar` y `quotes.getById` al guardar.
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
| R8 | Historial visible solo para superadmin | Consistente con `event_history`. |

---

## 6. Preguntas abiertas / pendientes

1. **Notificación al staff afectado.** El staff **no es usuario del sistema** (tabla `staff`: nombre,
   teléfono, email, sin login), así que no puede recibir notificaciones in-app, y la API no tiene
   infraestructura de email ni SMS. Opciones:
   - **a)** Fuera de esta fase: al guardar, mostrar el staff asignado con su teléfono / email para que
     el admin les avise manualmente. *(Recomendada para v1.)*
   - **b)** Agregar envío de email (proveedor nuevo, plantillas, manejo de errores). Es una feature en
     sí misma; mejor en su propio SDD.
   - También definir **a quién** se avisa: ¿a todo el staff asignado al evento, o solo a los que
     chocan?
2. **¿Operator puede reprogramar** sus propios eventos (scope `own`)? Propuesta: no.
3. **¿Límite de reprogramaciones** por evento? Propuesta: sin límite.

---

## 7. Plan de verificación

**Type-check**: `pnpm check-types`.

**Manual (móvil primero, después desktop):**

1. Catálogo: crear, editar, desactivar y reactivar motivos; nombre duplicado rechazado; operator no
   ve la página.
2. Reprogramar un evento próximo sin staff → fecha nueva en el detalle, el calendario, la lista y la
   cotización; el PDF aparece como desactualizado.
3. Cambiar solo la hora.
4. Motivo "Otro" sin nota → error; con nota → guarda.
5. Evento con staff que tiene otro evento en la fecha nueva → alerta no bloqueante → confirmación →
   guarda; `staffConflicts` registrado.
6. Fecha pasada → rechazada. Evento realizado o cancelado → botón oculto y API rechaza.
7. Evento con la fecha vencida y no realizado → se puede reprogramar; la alerta "pasó la fecha"
   desaparece.
8. Superadmin ve el historial de reprogramaciones; admin no.
9. Admins (excepto quien reprogramó) reciben la notificación `event_rescheduled`.
10. Evento con selecciones pendientes y recordatorio ya enviado → tras reprogramar, el recordatorio
    viejo desaparece del feed y el cron crea uno nuevo con el plazo de la fecha nueva.
11. Reprogramar sin hora a una fecha con otra reserva → aparece el aviso de doble reserva.
12. Staff con un evento cancelado (no archivado) en la fecha nueva → no figura como conflicto y sí
    como disponible en la asignación.

---

## 8. Archivos afectados (referencia)

**Packages**
- `packages/guards/src/constants/actions.ts` — `RESCHEDULE`.
- `packages/guards/src/constants/resources.ts` — `RESCHEDULE_REASON`.
- `packages/guards/src/mappings/permissions.matrix.ts`, `rolesPermissions.matrix.ts`.
- `packages/schemas/src/rescheduleReasons.ts` (nuevo), `packages/schemas/src/events.ts`,
  `packages/schemas/src/index.ts`.

**API**
- `apps/api/src/db/schema/rescheduleReasons.ts` (nuevo), `events.ts`, `index.ts` + migración.
- `apps/api/src/db/seeds/` — seed de motivos.
- `apps/api/src/modules/rescheduleReasons/` (nuevo).
- `apps/api/src/modules/events/events.{router,service,repository,resource}.ts`.
- `apps/api/src/modules/notifications/notifications.resource.ts`.
- `apps/api/src/core/trpc/router.ts` — registrar `rescheduleReasons`.
- Error codes (`ErrorCodes.event`, `ErrorCodes.rescheduleReason`).

**Web**
- `apps/web/src/features/reschedule-reasons/` (nuevo) + `app/admin/reschedule-reasons/`.
- `apps/web/src/features/events/components/detail/EventHeader.tsx`, `EventHistoryCard.tsx`,
  `RescheduleEventSheet.tsx` (nuevo), `hooks/`.
- `apps/web/src/features/notifications/` — render de `event_rescheduled`.
- Navegación del admin.
- `apps/web/src/locales/{es,en}/` — `events.json`, `notifications`, catálogo de motivos.

**Docs**
- `docs/mach-bar-domain.md` — excepción a D13.
