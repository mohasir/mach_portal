# Reprogramación de eventos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir reprogramar fecha / hora de un evento próximo con motivo de un catálogo nuevo, previsualización de conflictos, sincronización `events` + `quotes`, historial y notificación a admins.

**Architecture:** Dos piezas: (1) módulo CRUD nuevo `rescheduleReasons` (API + feature web espejo de `eventTypes` / `event-types`); (2) acción `RESCHEDULE` sobre `EVENT` con dos procedures (`checkReschedule`, `reschedule`) en el módulo `events`, una tabla de historial `event_reschedules` y una pantalla dedicada `/admin/events/[id]/reschedule`.

**Tech Stack:** Express 5 · tRPC v11 · Drizzle (`db:push`, sin migraciones) · Zod 4 · Next.js 15 · AntD v6 · Tailwind v4 · i18next · `react-icons/tb` (Tabler) · Vitest 5 (nuevo).

**Spec:** `docs/features/event-reschedule/sdd.md` (leer junto con este plan). Specs de patrón: `docs/backend/architecture.md`, `docs/frontend/architecture.md`, `docs/frontend/styling-guide.md`.

## Global Constraints

- **Tests (TDD):** Vitest se agrega en Task 0, solo para `apps/api` (services con repos falsos) y `apps/web/src/lib` (helpers puros, entorno `node`). Las tareas con lógica (3, 5, 7) siguen rojo → verde: test que falla → correrlo y ver el fallo → implementar → verde. **Sin tests**: queries SQL (necesitan Postgres), componentes React y `useDebouncedValue`; esos se verifican con `pnpm check-types` + checklist manual del SDD §7. Toda tarea termina con `pnpm check-types` sin errores.
- Los tests de services **no tocan la DB**: instanciar el service con objetos falsos que implementan solo los métodos usados (`as unknown as XRepository`) y `vi.fn()`.
- **Git:** no commitear por tarea. Los cambios quedan sin commitear; al final se le muestra al usuario el diff y se espera OK explícito antes de cualquier `commit` / `push` / PR.
- **No levantar servidores ni browser.** `db:push` y `db:seed` los corre el usuario; el plan solo indica cuándo.
- Comentarios en inglés, solo para el *por qué*; nada de comentarios que justifiquen decisiones de esta tarea.
- **Iconos nuevos de esta feature → Tabler vía `react-icons/tb`** (pedido explícito del usuario, reemplaza a `CalendarClock` de lucide que nombra el SDD): botón "Reprogramar" = `TbCalendarRepeat`, ítem de navegación de motivos = `TbCalendarTime`. `size` explícito y color por `currentColor`. Los íconos existentes no se tocan.
- Web: mobile-first; sin inline styles, CSS modules, hex hardcodeados ni `uppercase`; fechas con `useDateFormatter` / `src/lib/date`; todo texto por i18n (es + en).
- Permisos siempre con `RESOURCES` / `ACTIONS` (nunca literales); errores de dominio con `TRPCError` + `AppError(ErrorCodes…)` y su clave en `apps/web/src/locales/{es,en}/api.json` (`errors.<CODE>`).
- "Hoy" en el server = `todayInBusinessTimezone()` (`apps/api/src/lib/utils/date.ts`), no `new Date()`.

## Review Focus

1. **Evento sin fecha / hora previa** (`eventDate` o `eventTime` null): `fromDate` / `fromTime` se guardan null, `SAME_SCHEDULE` no debe disparar falsamente, el historial muestra "—". → Task 5 (regla 4) y Task 9.
2. **Hora vacía en la reprogramación**: `eventTime` omitido debe persistir `null` en `events` y `quotes` (no conservar la hora vieja), y `eventConflicts` se calcula por fecha. → Task 5.
3. **Operator / scope `own` llamando la API directo**: `checkReschedule` y `reschedule` deben dar `FORBIDDEN` aunque el evento sea suyo. → Task 1 (matriz), verificado en Task 5.
4. **Motivo inactivo enviado a mano** (id viejo en el form): rechazar con `RESCHEDULE_REASON_INACTIVE`, no guardar. → Task 5 (regla 5).
5. **Conflicto con un evento cancelado no archivado**: no aparece en conflictos y no bloquea disponibilidad (helper compartido). → Task 4.

---

### Task 0: Infraestructura de tests (Vitest)

**Files:**
- Create: `apps/api/vitest.config.ts`, `apps/api/src/test/setup.ts`, `apps/web/vitest.config.ts`
- Create: `apps/api/src/lib/utils/date.test.ts` (smoke test)
- Modify: `apps/api/package.json`, `apps/web/package.json`, `turbo.json`, `package.json` (raíz)

**Interfaces:**
- Produces: script `test` (`vitest run`) en `api` y `web`; tarea `test` en `turbo.json` (`{ "dependsOn": ["^check-types"] }`, sin outputs); script raíz `"test": "turbo run test"`.
- Produces: archivos de test colocados junto al código como `*.test.ts`.

- [ ] **Step 1:** `pnpm --filter api add -D vitest@^5` y `pnpm --filter web add -D vitest@^5`.
- [ ] **Step 2:** `apps/api/vitest.config.ts`: `environment: 'node'`, `include: ['src/**/*.test.ts']`, `setupFiles: ['src/test/setup.ts']`. El setup hace `vi.mock` de `src/env.ts` devolviendo un `env` con valores falsos: el service importa `lib/storage`, que lee `env` al cargarse y fallaría sin `.env`.
- [ ] **Step 3:** `apps/web/vitest.config.ts`: `environment: 'node'`, `include: ['src/**/*.test.ts']`, alias `@` → `src`.
- [ ] **Step 4:** Smoke test `date.test.ts`: `expect(subtractDays('2026-03-01', 1)).toBe('2026-02-28')` y `expect(addDays('2026-12-31', 1)).toBe('2027-01-01')`.
- [ ] **Step 5:** `pnpm --filter api test` → 1 archivo, PASS. `pnpm --filter web test` → "No test files found" está bien en este punto (agregar `passWithNoTests: true` al config de web).
- [ ] **Step 6:** `pnpm check-types` → sin errores (los `*.test.ts` entran en el `tsc` de cada app).

---

### Task 1: Permisos y contratos Zod

**Files:**
- Modify: `packages/guards/src/constants/actions.ts`, `packages/guards/src/constants/resources.ts`
- Modify: `packages/guards/src/mappings/permissions.matrix.ts`, `packages/guards/src/mappings/rolesPermissions.matrix.ts`
- Create: `packages/schemas/src/rescheduleReasons.ts`
- Modify: `packages/schemas/src/events.ts`, `packages/schemas/src/index.ts`

**Interfaces:**
- Produces: `ACTIONS.RESCHEDULE = 'reschedule'`, `RESOURCES.RESCHEDULE_REASON = 'reschedule_reason'`.
- Produces (schemas):
  - `rescheduleReasonsListQuerySchema = listQuerySchema.extend({ sortBy: z.enum(['name','isActive','sortOrder']).default('sortOrder'), isActive: z.boolean().optional() })` → `RescheduleReasonsListQuery`.
  - `createRescheduleReasonSchema` / `updateRescheduleReasonSchema` = `z.object({ name: z.string().trim().min(1,'rescheduleReasons.validation.nameRequired').max(120), requiresNote: z.boolean().default(false) })` → `CreateRescheduleReasonInput` / `UpdateRescheduleReasonInput`.
  - `rescheduleReasonToggleActiveSchema = z.object({ id: z.uuid(), isActive: z.boolean() })`.
  - `checkRescheduleSchema = z.object({ eventId: z.uuid(), eventDate: z.iso.date(), eventTime: optionalText(20) })` → `CheckRescheduleQuery`.
  - `rescheduleEventSchema = checkRescheduleSchema.extend({ reasonId: z.uuid(), note: optionalText(500) })` → `RescheduleEventInput`.

- [ ] **Step 1:** Agregar `RESCHEDULE` a `ACTIONS` y `RESCHEDULE_REASON` a `RESOURCES`.
- [ ] **Step 2:** `permissions.matrix.ts`: `EVENT` → `[...CRUD, MANAGE_SELECTIONS, MANAGE_STAFF_ASSIGNMENTS, RESCHEDULE]`; nueva entrada `{ resource: RESCHEDULE_REASON, actions: [VIEW, ...CRUD] }`.
- [ ] **Step 3:** `rolesPermissions.matrix.ts`: `EVENT_FULL` suma `RESCHEDULE` (superadmin + admin). Superadmin: `[RESCHEDULE_REASON]: [VIEW, ...CRUD]`. Admin: `[RESCHEDULE_REASON]: READ_ONLY`. Operator y member sin cambios.
- [ ] **Step 4:** Crear los schemas y reexportar `rescheduleReasons` en `index.ts`.
- [ ] **Step 5:** `pnpm check-types` → sin errores.

---

### Task 2: Tablas y seed

**Files:**
- Create: `apps/api/src/db/schema/rescheduleReasons.ts`, `apps/api/src/db/seeds/rescheduleReasons.ts`
- Modify: `apps/api/src/db/schema/events.ts`, `apps/api/src/db/schema/index.ts`, `apps/api/src/db/seeds/index.ts`

**Interfaces:**
- Produces: tablas Drizzle `rescheduleReasons` y `eventReschedules` como SDD §3.1 y §4.1 (`staffConflicts` con `.$type<{ staffId: string; name: string }[]>()`).

- [ ] **Step 1:** Crear `rescheduleReasons` (SDD §3.1) y exportarla en el barrel antes de `./events`.
- [ ] **Step 2:** Agregar `eventReschedules` al final de `events.ts` (SDD §4.1).
- [ ] **Step 3:** Seed idempotente por nombre, mismo patrón que `seeds/eventTypes.ts`: `Solicitado por el cliente`, `Clima`, `Otro` (`requiresNote: true`), `sortOrder` = índice. Llamarlo en el bloque base de `seeds/index.ts` después de `seedEventTypes()`.
- [ ] **Step 4:** `pnpm check-types` → sin errores.
- [ ] **Step 5:** Avisar al usuario que corra `pnpm --filter api db:push` y `pnpm --filter api db:seed --demo=<prod|local>`.

---

### Task 3: Módulo API `rescheduleReasons`

**Files:**
- Create: `apps/api/src/modules/rescheduleReasons/rescheduleReasons.{resource,repository,service,router}.ts`
- Modify: `apps/api/src/lib/errors/constants.ts`, `apps/api/src/core/trpc/router.ts`, `apps/web/src/locales/{es,en}/api.json`

**Interfaces:**
- Consumes: Task 1 schemas, Task 2 tabla.
- Produces: router `rescheduleReasons` con `list` (`READ`), `create` (`CREATE`), `update` (`UPDATE`, input `{ id, data }`), `toggleActive` (`UPDATE`). Item: `{ id, name, requiresNote, isActive, sortOrder }`.
- Produces: `RescheduleReasonsRepository.findById(id): Promise<{ id; name; requiresNote; isActive } | undefined>` (lo usa Task 5).
- Produces: `ErrorCodes.rescheduleReason = { NOT_FOUND: 'RESCHEDULE_REASON_NOT_FOUND', NAME_TAKEN: 'RESCHEDULE_REASON_NAME_TAKEN', INACTIVE: 'RESCHEDULE_REASON_INACTIVE' }`.

- Test: `apps/api/src/modules/rescheduleReasons/rescheduleReasons.service.test.ts`
- Produces: `RescheduleReasonsRepository.findByName(name: string, excludeId?: string)`.

- [ ] **Step 1:** Crear resource + repository espejando `modules/eventTypes/*` (incluye `resolvePagination` y la rama sin paginar). Diferencias: el resource expone `isActive` y `requiresNote`; `findPaginated` filtra por `isActive` cuando viene; `findByName` acepta `excludeId`. Agregar los `ErrorCodes`.
- [ ] **Step 2: Tests que fallan** (repo falso con `findByName`, `create`, `updateById`, `setActive`):

```ts
it('create rejects a duplicated name', async () => {
  repo.findByName.mockResolvedValue({ id: 'other' });
  await expect(service.create({ name: 'Clima', requiresNote: false }))
    .rejects.toMatchObject({ code: 'CONFLICT', cause: { code: 'RESCHEDULE_REASON_NAME_TAKEN' } });
});
it('update ignores its own name when checking duplicates', async () => {
  // expects findByName called with (name, id) and update to succeed
  expect(repo.findByName).toHaveBeenCalledWith('Clima', 'id-1');
});
it('update / toggleActive on a missing id → NOT_FOUND + RESCHEDULE_REASON_NOT_FOUND', ...);
it('list without page/pageSize returns items without pagination', ...);
```

- [ ] **Step 3:** `pnpm --filter api test rescheduleReasons` → FAIL (service inexistente).
- [ ] **Step 4:** Implementar `RescheduleReasonsService` y el router.
- [ ] **Step 5:** `pnpm --filter api test rescheduleReasons` → PASS.
- [ ] **Step 6:** Registrar `rescheduleReasons: rescheduleReasonsRouter` en `core/trpc/router.ts`; traducciones de los 3 códigos en `api.json` es/en.
- [ ] **Step 7:** `pnpm check-types` → sin errores.

---

### Task 4: Criterio único de "staff ocupado" + consultas de conflicto

**Files:**
- Create: `apps/api/src/modules/staff/staff.availability.ts`
- Modify: `apps/api/src/modules/staff/staff.repository.ts` (`findAvailable`, L72-84)
- Modify: `apps/api/src/modules/events/events.repository.ts`, `apps/api/src/modules/quotes/quotes.repository.ts`

**Interfaces:**
- Produces: `staffBusyOnDate(date: string): SQL` = `and(eq(events.eventDate, date), isNull(quotes.archivedAt), ne(quotes.stageId, QUOTE_STAGE.CANCELLED))`. Asume que la query une `eventStaff → events → quotes`.
- Produces: `EventsRepository.findStaffConflicts(eventId: string, date: string): Promise<{ staffId: string; name: string; conflictingEvent: { id: string; quoteNumber: string; eventTime: string | null } }[]>`.
- Produces: `QuotesRepository.findByDate(eventDate: string, excludeQuoteId?: string)` — mismo select y filtros que `findByDateTime`, sin la condición de hora.

- [ ] **Step 1:** Crear el helper y usarlo en `findAvailable` (reemplaza su `where`).
- [ ] **Step 2:** `findStaffConflicts`: staff asignado a `eventId` (alias de `eventStaff`) unido a otra fila de `eventStaff` del mismo `staffId` en un evento `≠ eventId` que cumpla `staffBusyOnDate(date)`; join `staff` (nombre) y `quotes` (número). Un staff con dos eventos en conflicto aparece dos veces.
- [ ] **Step 3:** `findByDate` en `QuotesRepository`.
- [ ] **Step 4:** `pnpm check-types` → sin errores.

---

### Task 5: Reprogramación en la API

**Files:**
- Modify: `apps/api/src/modules/events/events.{repository,service,router,resource}.ts`
- Modify: `apps/api/src/modules/notifications/notifications.resource.ts`
- Modify: `apps/api/src/lib/errors/constants.ts`, `apps/web/src/locales/{es,en}/api.json`

**Interfaces:**
- Consumes: Task 3 `RescheduleReasonsRepository.findById`, Task 4 `findStaffConflicts` / `findByDate`, `QuotesRepository.findByDateTime`, `quoteAvailabilityConflictResource`.
- Produces: `ErrorCodes.event` suma `NOT_RESCHEDULABLE: 'EVENT_NOT_RESCHEDULABLE'`, `DATE_IN_PAST: 'EVENT_DATE_IN_PAST'`, `SAME_SCHEDULE: 'EVENT_SAME_SCHEDULE'`, `NOTE_REQUIRED: 'EVENT_RESCHEDULE_NOTE_REQUIRED'`.
- Produces: `events.checkReschedule` → `{ staffConflicts: StaffConflict[]; eventConflicts: { id; number; clientName; eventTypeName }[] }`.
- Produces: `events.reschedule` → `eventResource` del evento actualizado.
- Produces: `events.getById` suma `reschedules: { id; fromDate; fromTime; toDate; toTime; reasonName; note; staffConflicts; rescheduledByName; rescheduledAt }[] | null` (null si no es superadmin), orden `rescheduledAt desc`.
- Produces: `NotificationType` suma `'event_rescheduled'` (audiencia `[ROLES.ADMIN]`) y `EventRescheduledData` (SDD §4.7, `source: 'user'`), agregado a la unión `NotificationData`.

- [ ] **Step 1: Repository.**
  - `findForReschedule(eventId)` → `{ id, quoteId, eventDate, eventTime, completedAt, quoteCancelled, quoteNumber, clientName }` (join quotes + clients; archivado = no encontrado).
  - `findReschedules(eventId)` (join `rescheduleReasons.name`, `user.name`).
  - `reschedule({ eventId, quoteId, from, to, reasonId, reasonName, note, staffConflicts, userId })` en una transacción con los 5 pasos de SDD §4.6. El `DELETE` de `notifications` filtra `type = 'event_selections_reminder'` y `entityId = eventId` (`notification_reads` cae por cascade). `event_history.data = { from: { date, time }, to: { date, time }, reasonName }`. Devuelve la fila de `events` con `publicEventColumns`.
- [ ] **Step 2: Tests que fallan** en `apps/api/src/modules/events/events.service.reschedule.test.ts`. Fixture base: evento próximo `{ eventDate: '2026-10-20', eventTime: '18:00', completedAt: null, quoteCancelled: false }`, motivo activo sin nota, `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-10-10T15:00:00Z'))` para fijar "hoy". Repos falsos: `EventsRepository` (`isAccessible`, `findForReschedule`, `findStaffConflicts`, `reschedule`), `QuotesRepository` (`findByDate`, `findByDateTime`), `RescheduleReasonsRepository` (`findById`), `NotificationsRepository` (`create`), `ConfigRepository` (vacío), storage `{}`.

| Test | Entrada | Esperado |
|---|---|---|
| no accesible / no existe | `isAccessible → false` | `NOT_FOUND`, `EVENT_NOT_FOUND`, `reschedule` no llamado |
| evento realizado | `completedAt: new Date()` | `BAD_REQUEST`, `EVENT_NOT_RESCHEDULABLE` |
| quote cancelada | `quoteCancelled: true` | `EVENT_NOT_RESCHEDULABLE` |
| fecha pasada | `eventDate: '2026-10-09'` | `EVENT_DATE_IN_PAST` |
| hoy es válido | `eventDate: '2026-10-10'` | guarda |
| fecha vencida sin realizar | evento con `eventDate: '2026-10-01'` → nueva `'2026-10-15'` | guarda (SDD §4.4 regla 2) |
| mismo horario | `'2026-10-20'`, `'18:00'` | `EVENT_SAME_SCHEDULE` |
| solo cambia la hora | `'2026-10-20'`, `'20:00'` | guarda |
| evento sin fecha previa | evento `eventDate: null, eventTime: null` | guarda, `from = { date: null, time: null }` |
| quitar la hora | evento con `'18:00'`, input sin `eventTime` | guarda con `to.time === null` |
| motivo inexistente | `findById → undefined` | `NOT_FOUND`, `RESCHEDULE_REASON_NOT_FOUND` |
| motivo inactivo | `isActive: false` | `BAD_REQUEST`, `RESCHEDULE_REASON_INACTIVE` |
| nota obligatoria faltante | `requiresNote: true`, sin `note` | `EVENT_RESCHEDULE_NOTE_REQUIRED` |
| conflictos no bloquean | `findStaffConflicts → [{ staffId:'s1', name:'Ana', conflictingEvent:{…} }]` | guarda; `reschedule` recibe `staffConflicts: [{ staffId:'s1', name:'Ana' }]` |
| notificación | caso feliz | `notifications.create` con `type: 'event_rescheduled'`, `excludedUserId: userId`, `data.toDate`, `data.fromDate`, `source: 'user'` |
| `checkReschedule` con hora | `eventTime: '18:00'` | usa `findByDateTime(date, '18:00', quoteId)` |
| `checkReschedule` sin hora | sin `eventTime` | usa `findByDate(date, quoteId)` |

- [ ] **Step 3:** `pnpm --filter api test reschedule` → FAIL (métodos inexistentes).
- [ ] **Step 4: Service — `checkReschedule(input, ownerId?)`.** `assertAccessible` → `findForReschedule` → `staffConflicts` + `eventConflicts` (con hora: `findByDateTime(date, time, quoteId)`; sin hora: `findByDate(date, quoteId)`).
- [ ] **Step 5: Service — `reschedule(input, userId, actor: NotificationActor, ownerId?)`.** Reglas en este orden (SDD §4.4):
  1. `assertAccessible`; no encontrado → `NOT_FOUND`.
  2. `completedAt` o `quoteCancelled` → `BAD_REQUEST` + `NOT_RESCHEDULABLE`.
  3. `input.eventDate < todayInBusinessTimezone()` → `DATE_IN_PAST`.
  4. `input.eventDate === current.eventDate && (input.eventTime ?? null) === current.eventTime` → `SAME_SCHEDULE`.
  5. Motivo inexistente → `NOT_FOUND` + `rescheduleReason.NOT_FOUND`; inactivo → `BAD_REQUEST` + `INACTIVE`.
  6. `requiresNote && !input.note` → `NOTE_REQUIRED`.
  7. Recalcular `findStaffConflicts`, persistir `{ staffId, name }[]`.
  8. Tras la transacción: `notificationsRepo.create({ type: 'event_rescheduled', data, entityType: 'event', entityId, excludedUserId: userId })`.
  - `EventsService` recibe `RescheduleReasonsRepository` y `NotificationsRepository` por constructor; actualizar toda instanciación (`events.router.ts`, y `events.controller.ts` / `events.express.ts` si instancian el service).
- [ ] **Step 6:** `pnpm --filter api test reschedule` → PASS (todas las filas de la tabla).
- [ ] **Step 7: Resource + getById.** `eventRescheduleResource(row)`; `buildEventDetail` recibe `rescheduleRows` y expone `reschedules`; el router lo anula si no es superadmin, igual que `history`.
- [ ] **Step 8: Router.** `checkReschedule` (`.query`) y `reschedule` (`.mutation`) con `guardedProcedure({ [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] })`, `ownerScope(ctx)` y actor `{ name: ctx.user.name, image: ctx.user.image ?? null }` como en `quotes.router.ts::approve`.
- [ ] **Step 9: Test de permisos** (`packages/guards` no tiene runner propio, se prueba desde la API) en `apps/api/src/modules/events/events.permissions.test.ts`: `hasPermission('operator', { event: ['reschedule'] }) === false`, `'admin'` y `'superadmin'` → `true`; `hasPermission('admin', { reschedule_reason: ['view'] }) === false`, `['read']` → `true` (usar `RESOURCES` / `ACTIONS`). Correr → PASS (la matriz ya existe desde Task 1).
- [ ] **Step 10:** Traducciones de los 4 códigos nuevos en `api.json` es/en.
- [ ] **Step 11:** `pnpm --filter api test` → todo PASS; `pnpm check-types` → sin errores.

---

### Task 6: Feature web `reschedule-reasons` + navegación

**Files:**
- Create: `apps/web/src/features/reschedule-reasons/` (espejo de `features/event-types/`: `types.ts`, `index.ts`, `hooks/useRescheduleReasons.ts`, `hooks/useRescheduleReasonRowActions.tsx`, `components/{RescheduleReasonsPage,RescheduleReasonsTable,columns,RescheduleReasonForm,CreateRescheduleReasonModal,EditRescheduleReasonModal}.tsx`)
- Create: `apps/web/src/app/admin/reschedule-reasons/page.tsx`, `apps/web/src/locales/{es,en}/rescheduleReasons.json`
- Modify: `apps/web/src/lib/i18n/config.ts`, `apps/web/src/lib/navigation/constants/items.ts`, `apps/web/src/lib/navigation/config.ts`, `apps/web/src/lib/navigation/constants/icons.tsx`, `apps/web/src/locales/{es,en}/admin.json`

**Interfaces:**
- Consumes: router `rescheduleReasons` (Task 3).
- Produces: type `RescheduleReason`; `useRescheduleReasonsList(query: RescheduleReasonsListQuery)` exportado por el barrel (lo usa Task 8).

- [ ] **Step 1:** Feature espejo de `event-types`. Form: `name` (Input) + `requiresNote` (Switch). Columnas: nombre, "Requiere nota" (Tag sí / no), estado activo, acciones (`edit` y toggle activo con guard `UPDATE`). Botón "Agregar" gateado con `CREATE`.
- [ ] **Step 2:** `RESCHEDULE_REASONS_ITEM = { label: 'nav.rescheduleReasons', href: '/admin/reschedule-reasons', icon: 'rescheduleReasons', guard: { [RESOURCES.RESCHEDULE_REASON]: [VIEW] } }` en `NAV_ITEMS`, en el grupo catálogo después de `EVENT_TYPES`. Icono `TbCalendarTime` (`react-icons/tb`) en ambos mapas de `icons.tsx`, igual que `eventTypes`. La ruta queda protegida por `route-access.ts` (deriva de `NAV_ITEMS`).
- [ ] **Step 3:** i18n es/en (namespace `rescheduleReasons` registrado en `config.ts`; label de nav en `admin.json`).
- [ ] **Step 4:** `pnpm check-types` → sin errores.

---

### Task 7: Helper compartido de pickers

**Files:**
- Modify: `apps/web/src/lib/date/index.ts`
- Modify: `apps/web/src/features/quotes/components/builder/EventSection.tsx:67-77`

**Interfaces:**
- Produces: `disabledPastDate(current: Dayjs): boolean` y `disabledPastTime(selectedDate: Dayjs | null | undefined): () => { disabledHours?: () => number[]; disabledMinutes?: (hour: number) => number[] }` — misma lógica que hoy vive en `EventSection`.

- Test: `apps/web/src/lib/date/pickers.test.ts`

- [ ] **Step 1: Tests que fallan** (fijar "ahora" con `vi.setSystemTime(new Date(2026, 9, 10, 14, 30))`, hora local):
  - `disabledPastDate(dayjs('2026-10-09'))` → `true`; `'2026-10-10'` → `false`; `'2026-10-11'` → `false`.
  - `disabledPastTime(undefined)()` → `{}`; `disabledPastTime(dayjs('2026-10-11'))()` → `{}`.
  - `disabledPastTime(dayjs('2026-10-10'))()`: `disabledHours()` = `[0..13]`; `disabledMinutes(14)` = `[0..29]`; `disabledMinutes(15)` = `[]`.
- [ ] **Step 2:** `pnpm --filter web test pickers` → FAIL (funciones inexistentes).
- [ ] **Step 3:** Mover la lógica a `lib/date` y usarla en `EventSection` (`disabledDate={disabledPastDate}`, `disabledTime={disabledPastTime(eventDate)}`).
- [ ] **Step 4:** `pnpm --filter web test pickers` → PASS.
- [ ] **Step 5:** `pnpm check-types` → sin errores. El builder debe comportarse igual (SDD §7 ítem 13).

---

### Task 8: Pantalla de reprogramación

**Files:**
- Create: `apps/web/src/lib/hooks/useDebouncedValue.ts`
- Create: `apps/web/src/features/events/hooks/useReschedule.ts`
- Create: `apps/web/src/features/events/components/reschedule/{RescheduleEventPage,RescheduleConflicts}.tsx`
- Create: `apps/web/src/app/admin/events/[id]/reschedule/page.tsx`
- Modify: `apps/web/src/features/events/index.ts`, `apps/web/src/features/events/components/detail/EventHeader.tsx`, `apps/web/src/lib/auth/route-access.ts`, `apps/web/src/locales/{es,en}/events.json`

**Interfaces:**
- Consumes: Task 5 procedures, Task 6 `useRescheduleReasonsList`, Task 7 helpers.
- Produces: `useDebouncedValue<T>(value: T, delayMs: number): T`.
- Produces: `useCheckReschedule(eventId: string, eventDate?: string, eventTime?: string)` (habilitada solo con `eventDate`; valores debounced 400 ms).
- Produces: `useRescheduleEvent()` → `{ rescheduleEvent: (input: RescheduleEventInput) => Promise<…>; isPending }`; `onSuccess`: `message.success`, invalida `trpc.events.pathFilter()` y `trpc.quotes.getById.queryFilter()`; `onError: useApiError()`.
- Produces: `RescheduleEventPage({ eventId }: { eventId: string })` exportado por el barrel.

- [ ] **Step 1:** Hooks.
- [ ] **Step 2: `route-access.ts`.** Antes de la búsqueda por `NAV_ITEMS`, una lista `ROUTE_PATTERNS: { pattern: RegExp; guard: PermissionCheck }[]` con `/^\/admin\/events\/[^/]+\/reschedule\/?$/ → { [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] }` (sin esto la ruta hereda el guard `EVENT:READ` de `/admin/events`).
- [ ] **Step 3: `RescheduleEventPage`** (SDD §4.8):
  - Skeleton en la primera carga; si `event.status !== 'upcoming'` → `router.replace('/admin/events/{id}')`.
  - Layout: una columna en móvil (resumen → form → conflictos); desde `lg`, dos columnas con el form a la izquierda y conflictos a la derecha.
  - Form AntD: `eventDate` / `eventTime` con `WrapperDatePicker` / `WrapperTimePicker` como el builder (`sheetTitle`, `minuteStep={15}`, `disabledPastDate`, `disabledPastTime`, `hasFeedback` / `validateStatus` según `isFetching` y conflictos), precargados; `reasonId` (`Select` con `useRescheduleReasonsList({ isActive: true, sortBy: 'sortOrder', sortDir: 'asc' })`, sin paginar); `note` (`Input.TextArea`, `required` si el motivo elegido tiene `requiresNote`, max 500).
  - Guardar: si hay `staffConflicts`, confirmar (`useConfirmModal` en móvil, `modal.confirm` en desktop) con el texto del SDD; luego `rescheduleEvent` y volver al detalle. Cancelar vuelve al detalle.
- [ ] **Step 4: `RescheduleConflicts`.** `WrapperAlert` warning no bloqueante con el staff que choca (`name` — `#quoteNumber` · hora con `time()`), y otro con los eventos en la misma fecha / hora (`clientName — eventTypeName`).
- [ ] **Step 5: `EventHeader`.** Botón `TbCalendarRepeat` (`react-icons/tb`, size 14) "Reprogramar" dentro del `Space` de `isUpcoming`, envuelto en `<Can allowed={{ [RESOURCES.EVENT]: [ACTIONS.RESCHEDULE] }}>`, con `router.push` a la pantalla.
- [ ] **Step 6:** Página thin en `app/admin/events/[id]/reschedule/page.tsx` (mismo patrón que `[id]/page.tsx`). i18n es/en bajo `events.reschedule.*`.
- [ ] **Step 7:** `pnpm check-types` → sin errores.

---

### Task 9: Historial y notificación en la web

**Files:**
- Modify: `apps/web/src/features/events/components/detail/EventHistoryCard.tsx`, `EventDetailPage.tsx`
- Modify: `apps/web/src/features/notifications/components/NotificationCard.tsx`
- Modify: `apps/web/src/locales/{es,en}/events.json`, `apps/web/src/locales/{es,en}/notifications.json`

**Interfaces:**
- Consumes: `EventDetail['reschedules']`, `EventRescheduledData` (Task 5).

- [ ] **Step 1:** `EventHistoryCard` recibe `reschedules` (no null, mismo type guard que `history` en `EventDetailPage`). Caso `'rescheduled'` en `describe`. Sección "Reprogramaciones": por fila, fecha / hora anterior → nueva (`date` / `time`, "—" si null), motivo, nota, quién y cuándo (`dateTime`), y el staff en conflicto si hay.
- [ ] **Step 2:** `NotificationCard`: en la rama `source === 'user'`, si `'toDate' in data`, formatear `fromDate` / `toDate` con `date()` (null → "—"). Clave `types.event_rescheduled` es/en: `<bold>{{actorName}}</bold> reprogramó el evento de <bold>{{clientName}}</bold> al <bold>{{toDate}}</bold>`.
- [ ] **Step 3:** `pnpm check-types` → sin errores.

---

### Task 10: Documentación de dominio + cierre

**Files:**
- Modify: `docs/mach-bar-domain.md`, `docs/features/event-reschedule/sdd.md` (estado → implementado; nota de íconos Tabler en §4.8)

- [ ] **Step 1:** Agregar **D19** a la tabla de decisiones: la reprogramación es la única escritura permitida sobre una quote Aprobada, solo `eventDate` / `eventTime` y solo por este flujo; la fecha original queda en `event_reschedules` (SDD §4.2).
- [ ] **Step 2:** `pnpm test` y `pnpm check-types` finales → todo PASS, sin errores.
- [ ] **Step 3:** Entregar al usuario la checklist manual del SDD §7 (1–14) y el resumen del diff; pedir OK antes de commitear.
