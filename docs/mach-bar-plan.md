# Mach Bar — Plan de ejecución

> Cómo construimos el dominio, **módulo por módulo**, empezando por los que **no tienen dependencias**
> y subiendo hacia los que dependen de varias relaciones. Cada módulo se hace **backend → frontend**,
> se **testea** con `db:fresh`, y se refina su **seeder**.
>
> Patrón estricto: `docs/backend/architecture.md §9` (módulo) y `docs/frontend/architecture.md §13`
> (feature). Módulo **espejo ya existente**: `users` (copiar su estructura). Docs de referencia y
> estado de avance, abajo.

---

## Docs de referencia (leer al retomar)

| Doc                                                                                                 | Rol                                                                                               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `mach-bar-domain.md`                                                                                | **Modelo de datos** (canónico): tablas, enums, decisiones D1–D15, precio en cents, estados, RBAC. |
| `mach-bar-model.dbml`                                                                               | ER para dbdiagram.io (nombres genéricos).                                                         |
| `mach-bar-flows.md`                                                                                 | **Flujos de front** (canónico): las 8 superficies (§2–§8).                                        |
| `mach-bar-plan.md`                                                                                  | **Este doc**: plan de ejecución + progreso.                                                       |
| `mach-bar-specs.md`                                                                                 | Spec original (raw). **Superado** por domain/flows; queda como insumo histórico.                  |
| `docs/backend/architecture.md` · `docs/frontend/architecture.md` · `docs/frontend/styling-guide.md` | Patrón estricto de BE/FE/estilos.                                                                 |

**Canónico = `domain` + `model` + `flows`.** Ante conflicto con `mach-bar-specs.md`, mandan los refinados.

---

## Estado / progreso (resumible entre sesiones)

> **Cómo retomar en una sesión nueva:** (1) leé los docs canónicos de arriba; (2) mirá la tabla y el
> **Próximo paso**; (3) continuá desde ahí. **Actualizá esta sección** al cerrar cada tarea: marcá ✅,
> movés el "Próximo paso" y agregás una línea a la bitácora.

**Última actualización:** 2026-07-15 · **Fase actual:** Eventos (Fase 5) — **cierra la fase (BE+FE+
seeder+checkpoint)** (ver bitácora) · **Próximo paso:** Fase 6 **Dashboard** (agregaciones + gráfica).
En paralelo sigue pendiente, sin bloquear: terminar el re-seed de catálogo con datos reales (7 de 10
estaciones + decisión de precio de Craft Bar).

Leyenda: ☐ pendiente · 🔨 en progreso · ✅ hecho

| Fase | Módulo          | BE  | FE  | Seeder | Checkpoint |
| ---- | --------------- | :-: | :-: | :----: | :--------: |
| 1    | Clientes        | ✅  | ✅  |   ✅   |     ✅     |
| 1    | Staff           | ✅  | ✅  |   ✅   |     ✅     |
| 2    | Catálogo        | ✅  | ✅  |   🔨   |     🔨     |
| 2    | Tipos de evento | ✅  | ✅  |   ✅   |     ✅     |
| 3    | Configuración   | ✅  | ✅  |   ✅   |     ✅     |
| 4    | Cotizaciones    | ✅  | ✅  |   ✅   |     ✅     |
| 5    | Eventos         | ✅  | ✅  |   ✅   |     ✅     |
| 6    | Dashboard       |  ☐  |  ☐  |   ☐    |     ☐      |

> 🔨 **Catálogo — rework D16/D17 cerrado en código, falta el re-seed real.** Schema
> (`product_price_tiers`, `option_groups.selection_type`, `options.description`), `@repo/schemas`,
> módulo `products` (con sub-router `products.prices.*`) y forms FE ya están hechos y en `dev`
> (`check-types` monorepo limpio). **Pendiente:** de las 10 estaciones seedeadas, solo **Mini
> Pancakes, Crepaletas y Esquites** tienen tabla de precios real; **Crepes, Nachos, Fruit Station,
> Snack Station, Popsicles, Hot Chocolate y Craft Bar** siguen con `PLACEHOLDER_TIERS` en
> `apps/api/src/db/seeds/catalog.ts`. Craft Bar además tiene pendiente la **decisión de modelo de
> precio** (fija vs. por hora) antes de poder cargarle tramos reales. Debe cerrar **antes** de Fase 4.

**Fundaciones** (transversales): guards nuevos ✅ (`STAFF`/`PRODUCT`/`EVENT_TYPE`/`CONFIG` — todos los de Fase 1-3) · enum `state` compartido ✅ · cents (BE) ✅ + `formatMoney`/`useMoneyFormatter` (FE, **currency configurable** vía `config.get`) ✅ · `%` helper ✅ (`lib/percent`) · dnd-kit ✅ (`SortableList`/`useSortableRow`/`ReorderControl` en `features/catalog`) · `computeQuoteTotals` ✅ (`@repo/schemas/quotes`, Fase 4)

**Bitácora de sesión** (lo último arriba):

- **2026-07-15** — **Ajuste post-cierre de Fase 5: calendario pasa a página propia.** A pedido del
  usuario, el tab "Calendario" de `/admin/events` se separa en una superficie propia
  `/admin/calendar` (`CalendarPage`, nuevo ítem de nav "Calendario" — `NAV_ITEMS.CALENDAR`, debajo del
  botón "Nueva cotización" en el sidebar, mismo guard `EVENT:READ`; `route-access` lo cubre solo por
  existir en `NAV_ITEMS`, sin tocar `route-access.ts`). La primera tab de `/admin/events` pasa a
  llamarse **"Eventos"** y ahora es una tabla estándar (`EventsTable`, ya existía para la ficha de
  cliente) con **acciones por fila** nuevas (`useEventRowActions`): ver detalle (preset `detail`),
  y — solo si `status==='upcoming'` + `EVENT:UPDATE` — asignar staff (abre `AssignStaffModal`
  compartido), marcar realizado y cancelar (mismas mutaciones/confirms que `EventHeader` del detalle).
  Esto deja las acciones disponibles sin entrar al detalle, tanto en la tabla principal como en la tab
  "Eventos" de la ficha de cliente (mismo componente `EventsTable`, se benefician ambas). Deviación
  del `mach-bar-flows.md §6.2` original (que describía el calendario como tab, no como página) —
  decisión explícita del usuario tras ver la Fase 5 armada. `check-types` monorepo limpio, verificado
  por curl (200 sin error de servidor) en `/admin/calendar`, `/admin/events` y `/admin/clients/[id]`.
- **2026-07-15** — **Eventos (Fase 5) — frontend completo, cierra la fase.** Feature `events`
  (`apps/web/src/features/events`): `EventsCalendar.tsx` — `<Calendar>` de AntD con `cellRender`
  (badges por día vía `Grid.useBreakpoint()`: lista completa de badges en desktop/tablet, contador
  compacto en `xs`; `onPanelChange` mantiene el mes visible en estado para refetchear
  `events.calendar`), reemplaza el placeholder "coming soon" del tab "Calendario" en `/admin/events`.
  Lista de eventos estándar (`columns`/`EventCard`/`EventsTable`, acepta `clientId` opcional — la
  reusa la ficha de cliente). **Detalle de evento** a medida `/admin/events/[id]`
  (`features/events/components/detail/`): `EventHeader` (número de quote, fecha/hora, tag de tipo,
  badge de status, acciones "ver quote"/"marcar realizado"/"cancelar" — las 2 últimas solo si
  `status==='upcoming'`, cancelar reusa `quotes.cancel` que ahora también invalida `events` para que
  el status derivado se refresque), `EventComposition` (read-only, D13: resuelve nombres de
  producto/opción contra `useProductCatalog()`, igual que `QuotePreview` del builder — `events.lines`
  solo trae ids), `EventPayments` (toggles deposit/balance + `paymentMethod`, con botón "Guardar"
  explícito — el monto de depósito/saldo se obtiene con un fetch adicional a `quotes.getById(quoteId)`
  ya que `events` solo snapshotea `totalAmount`, no `depositAmount`), `EventStaffPanel` (lista +
  quitar + botón "Asignar"). `AssignStaffModal` (`features/quotes/components/pipeline/`, compartido
  pipeline+detalle): `staff.getAvailability(eventDate)` → `Select` + rol opcional → `events.assignStaff`.
  `QuoteCard.tsx` del pipeline: bloque nuevo gateado `stageId===CONFIRMED` +
  `useCan(EVENT:UPDATE)` con contador de staff (ícono + `staffAssignedCount`, sin avatares con nombre
  — el board solo expone el conteo, evitar N+1) + botón "Asignar" que abre el modal compartido.
  **Ficha de cliente 360** `/admin/clients/[id]` (`features/clients/components/detail/`):
  `ClientInfoCard` (reusa `EditClientModal`), tabs Cotizaciones (`quotes.list({clientId})`, ya
  soportado por el schema, más botón "Nueva cotización" que precarga el cliente vía querystring
  `?clientId=&clientName=` — se extendió `emptyBuilderState`/`QuoteBuilderPage` para leerlo) y Eventos
  (reusa `EventsTable` con `clientId`). Nuevo `clients.getById`/`useClient`. Se agregó navegación de
  fila a `/admin/clients/[id]` en `ClientsTable`/`ClientCard` (antes ninguna fila era clickeable) —
  requirió envolver `DataTableRowActions` en un `stopPropagation` local (mismo gotcha de portales ya
  documentado en la bitácora de Fase 4: los clicks de un `Dropdown`/`Modal` burbujean por el árbol de
  React, no el DOM). i18n `events.json` (es/en) nuevo namespace + claves nuevas en `clients.json`/
  `quotes.json`. `check-types` monorepo limpio. **Bug encontrado y corregido en la verificación**:
  `useEventStaff.ts`/`useEventPayments.ts` importaban `App` (antd) y `useTranslation` (react-i18next)
  directo, sin `'use client'` propio — al quedar re-exportados desde el barrel `features/events/index.ts`,
  que un Server Component (`app/admin/events/page.tsx`) importa, Next intentó bundlear esos módulos
  del lado servidor y explotaba (`createContext is not a function`, React de RSC no lo expone). Fix:
  `'use client'` al tope de ambos archivos — mismo patrón que ya usan `useApiError.ts`/
  `useUpdateConfig.ts` en el resto del proyecto. **Verificación**: sin navegador disponible en el
  entorno de esta sesión, se verificó por curl con sesión real (login superadmin): `/admin/events`,
  `/admin/events/[id]`, `/admin/clients/[id]`, `/admin/events?view=pipeline` y
  `/admin/quotes/new?clientId=` devuelven **HTTP 200 sin error de servidor** (el bug de arriba se
  detectó así, como 500 antes del fix); `events.calendar`/`events.list`/`events.getById`/
  `clients.getById` devuelven las formas esperadas por tRPC. **Pendiente de verificación visual**
  (interacción real: calendario, modal de asignar staff, toggles de pago, mobile) — queda para
  revisión humana en browser. **Cierra Fase 5** (BE+FE+seeder+checkpoint ✅).
- **2026-07-15** — **Eventos (Fase 5) — backend completo y verificado en vivo** (el usuario pidió
  parar antes del FE, mismo ritmo que Fase 4). Schema nuevo `events`/`event_staff`
  (`apps/api/src/db/schema/events.ts`; `events.quoteId` UNIQUE → 1 evento por quote, D4; composición
  **no se copia** — se lee de la quote vía `quoteId`, D13). Se agregó el enum `payment_method`
  (`zelle/cash/card/check`) que el domain doc ya preveía pero no existía en código, más un campo
  propio **`events.completedAt`** (nullable) para "marcar realizado" (D5: ya no depende de
  `quote.stageId`, que es terminal en Aprobada) — no estaba explícito en el dbml, se agregó siguiendo
  `mach-bar-flows.md §6.3`. `@repo/schemas/events.ts` nuevo (`eventsListQuerySchema` con filtro
  `clientId` para la ficha de cliente, `eventsCalendarQuerySchema`, `updateEventPaymentSchema`,
  `assignStaffSchema`/`removeStaffSchema`) + `staffAvailabilityQuerySchema` en el `staff.ts`
  existente. Módulo `apps/api/src/modules/events/` (resource/repository/service/router, patrón
  `docs/backend/architecture.md §3`): `list` (paginado, filtra por `clientId`), `calendar` (bulk por
  mes/año, mismo criterio que `quotes.board` vs `quotes.list`), `getById` (composición de líneas leída
  de `quote_lines`/`quote_line_options` — se extrajo `buildQuoteLineDetails` de
  `quotes.resource.ts` para compartir esa transformación entre quotes y events sin duplicarla),
  `updatePayment`, `markCompleted`, `assignStaff`/`removeStaff` (con chequeo de "ya asignado" antes
  del unique constraint, mejor UX que el 500 crudo). Todo gatea sobre `RESOURCES.EVENT`/`UPDATE` —
  **sin ACTIONS nuevas**, mismo patrón que `quote.approve`/`cancel`. Nuevo `staff.getAvailability`
  (anti-join contra `event_staff`⨝`events` por `eventDate`, solo activos) agregado al módulo `staff`
  existente. **`quotes.approve` ahora sí crea el evento** (cerraba pendiente desde Fase 4,
  `mach-bar-domain.md §11`): nuevo `QuotesRepository.approveWithEvent` — update de stage + insert de
  historial + insert de `events` en **una sola transacción**; la idempotencia la da la matriz de
  transiciones (no existe `CONFIRMED→CONFIRMED`), no hizo falta `onConflictDoNothing` sobre el unique
  de `quoteId`. `quotes.board`/`quoteCardResource` ahora exponen `eventId`/`depositPaid`/
  `staffAssignedCount` por card (vía `leftJoin` a `events` + subquery de conteo sobre `event_staff`) —
  lo que va a consumir el botón "Asignar" + avatares del pipeline en el FE. Se sumó también
  **`clients.getById`** (no existía; lo pedía la ficha de cliente 360) reusando la subquery de
  `status` derivado ya escrita en `findPaginated`. Nuevo seeder `seedEvents` (corre después de
  `seedQuotes`): crea eventos para las quotes ya `CONFIRMED` de la semilla (Priya Nair/Corporativo,
  James O'Connor/Boda) y asigna 2 staff activos por evento (round-robin). `check-types` monorepo
  limpio. **Verificado en vivo por tRPC** (login superadmin real, `db:fresh` limpio): `events.list`/
  `calendar`/`getById` devuelven bien (composición correcta, montos coinciden con la quote origen);
  `staff.getAvailability` excluye correctamente al staff ya asignado ese día; `clients.getById`
  funciona; `quotes.approve` sobre una quote `Enviada` crea el evento atómicamente y el board lo
  refleja al toque; re-aprobar la misma quote rechaza por `QUOTE_INVALID_TRANSITION` (idempotencia
  confirmada); `assignStaff` rechaza una segunda asignación del mismo staff
  (`EVENT_STAFF_ALREADY_ASSIGNED`); `updatePayment`/`markCompleted`/`removeStaff` OK. Se corrió
  `db:fresh` una vez más al cerrar para dejar la semilla limpia (las pruebas en vivo mutaron una
  quote). **Pendiente (Fase 5 FE, plan detallado en
  `/Users/sambar/.claude/plans/foamy-petting-lightning.md`):** calendario real (AntD `Calendar` +
  `cellRender` con badges por día — reemplaza el placeholder "coming soon" del tab "Calendario" en
  `/admin/events`), detalle de evento a medida (`/admin/events/[id]`), `AssignStaffModal` compartido
  (pipeline + detalle), avatares/botón "Asignar" en `QuoteCard` del pipeline, y ficha de cliente 360
  (`/admin/clients/[id]`) — todo ya alineado con el usuario antes de escribir código de FE.
- **2026-07-15** — **Rework post-cierre de Cotizaciones: stages por id + createdBy + historial
  (D18).** A pedido del usuario, con el dominio todavía joven, se corrigió el modelo de
  `quotes.stage` antes de construir Fase 5 encima: (1) **`quote_stage` deja de ser `pgEnum`** — pasa
  a la tabla **`quote_stages`** (`id` **entero hardcodeado** 1-4, `label`, `color` preset de
  AntD, `sortOrder`), conjunto **fijo** (sin alta/baja), editable en label/color desde una tarjeta
  nueva "Estados de cotización" en Configuración (mismo patrón que `state_settings`: filas fijas,
  `config.update` con un tercer bucket `quoteStages`). Los ids se hardcodean en `@repo/schemas`
  (`QUOTE_STAGE.PENDING/QUOTED/CONFIRMED/CANCELLED`) — la lógica de dominio (matriz de transiciones,
  `EDITABLE_STAGES`) sigue esos ids fijos, nunca strings ni el label. (2) **Se elimina el stage
  "Realizada"** — quedan solo 4: Pendiente (ex "Borrador"), Enviada, Aprobada (ex "Confirmada"),
  Cancelada. Aprobada es ahora **terminal** para la quote (sin transición saliente salvo cancelar);
  "marcar el evento como realizado" deja de ser un stage de `quotes` y pasa a ser un **campo propio
  de `events`** (Fase 5, todavía sin construir — cero migración necesaria, solo ajustar el plan).
  Actualizado también `mach-bar-domain.md` (D1/D5/D11, nueva D18) y `mach-bar-flows.md` (§3.2 matriz
  4×4, §2.12 nuevo, §5.2/§6.2/§6.3/§8.1). (3) **`quotes.number`** en mayúscula (`QUO...` en vez de
  `quo...`). (4) **`quotes.createdById`** (FK a `user.id`, `onDelete: set null`) + tabla
  **`quote_stage_history`** (`quoteId, fromStageId, toStageId, changedById, changedAt` — una fila por
  transición, más la inicial en creación con `fromStageId=null`); `insertFull`/`updateStage` del
  repo ahora son transaccionales (mutación + insert de historial en la misma tx). Nueva sección
  **"Historial"** (`QuoteHistoryCard`) en el detalle/builder de la quote, siempre visible: quién la
  creó + timeline de cambios de stage con nombre y fecha. Seeder: nuevo `seedQuoteStages` (corre
  antes que `seedQuotes`); `seedQuotes` atribuye `createdById` al superadmin sembrado
  (`samuel@admin.com`) y arma un historial simplificado (creación + salto directo al stage final,
  sin re-simular cada paso intermedio). `check-types` monorepo limpio. **Pendiente**: verificar en
  vivo con `db:fresh` (login real, pipeline de 4 columnas, editor de stages en Settings, historial en
  el detalle).
- **2026-07-14** — **Cotizaciones (Fase 4) — FE completo, cierra la fase.** Feature `quotes`
  (`apps/web/src/features/quotes`): **lista** estándar `/admin/quotes` (`QuotesPage`/`QuotesTable`,
  filtros stage/state, click en fila navega al detalle, sin row actions destructivas — el pipeline es
  donde se cambia de stage); **constructor** a medida `/admin/quotes/new` + `/admin/quotes/[id]`
  (`QuoteBuilderProvider`/`useQuoteBuilder` con `useReducer` — estado local efímero, NO TanStack Query,
  per `mach-bar-flows.md §2`; `ClientSection` combobox + alta inline de lead con mini-form propio
  nombre+teléfono — no reusa `ClientForm` completo, a propósito; `EventSection`; `LineBuilder` con
  `ProductPicker`/`LineCard`/`OptionGroupChips` — chips con bloqueo por `maxSelect`, grupos `included`
  read-only; `PricingPanel` + `QuotePreview` con `computeQuoteTotals` **compartido** de
  `@repo/schemas`, mismo cálculo que el server; 2 columnas desktop / 1 columna + barra inferior fija +
  Drawer de preview en móvil; modo **read-only** completo cuando `stage` no es `new`/`quoted`); **pipeline**
  `/admin/pipeline` (`PipelineBoard` con dnd-kit `useDraggable`/`useDroppable` — no `SortableList`, es
  cross-column no reorder — kanban en desktop, `Segmented` + menú "Mover a…" en móvil; confirm modal en
  transiciones con efecto `approve`/`cancel`; optimistic update sobre el cache de `quotes.board` con
  rollback). Ajuste chico al backend: `quotes.getById` ahora denormaliza `clientName`/`eventTypeName`
  (no existe `clients.getById`, el constructor en modo edición los necesita para mostrar el cliente
  actual). Nueva dependencia **`dayjs`** en `apps/web` (solo para `DatePicker`/`TimePicker` de AntD, que
  la requieren nativamente — decisión consciente, discutida con el usuario; el resto de la app sigue
  formateando fechas con `date-fns`/`useDateFormatter` sin cambios). i18n `quotes.json` (es/en) + reuso
  de `useProductCatalog` nuevo en `features/catalog` (`products.list`, activos only, para el builder) y
  `ClientForm`/`useCreateClient` de `features/clients` para el alta de lead. **3 bugs encontrados y
  corregidos en la prueba en vivo (Playwright headless, desktop 1440px + mobile 390px)**: (1)
  `ClientSection`/`EventSection` no recibían `readOnly` — una quote `confirmed`/`cancelled` se veía
  editable en esos dos bloques (los inputs de `LineBuilder` sí estaban bien gateados); (2) la barra de
  acciones inferior en móvil amontonaba 3 botones + total en una sola fila y se cortaba en 390px —
  ahora es 2 filas (total+preview arriba, guardar/enviar a ancho completo abajo); (3) **el más
  importante**: en el menú "Mover a…" del pipeline en móvil, click en una opción también navegaba al
  detalle de la quote — el `Dropdown` de AntD renderiza el menú en un portal, y los eventos sintéticos
  de React burbujean por el **árbol de React** (no el DOM), así que el `stopPropagation` en el wrapper
  del trigger no alcanzaba al click del item del menú; fix: `stopPropagation` en el `domEvent` de cada
  item del menú. Verificado en vivo (login real, ambos viewports): CRUD completo del constructor
  (crear→guardar borrador→reabrir→editar, con persistencia y rehidratación correctas), ciclo de stage
  completo por drag simulado imposible en headless (dnd-kit no dispara con `page.mouse` sintético — se
  probó el path equivalente del menú "Mover a…" que llama la misma función, incluyendo el modal de
  confirmación de "Aprobar"), `check-types` monorepo limpio, cero errores de consola. `db:fresh` para
  dejar la semilla limpia al cerrar. **Cierra Fase 4** (BE+FE+seeder+checkpoint ✅).
- **2026-07-14** — **Cotizaciones (Fase 4) — backend completo y verificado en vivo** (el usuario pidió
  pausar antes del FE). Schema `quotes`/`quote_lines`/`quote_line_options` (`quote_stage`/
  `discount_type` enums propios del archivo, igual que `option_group_type` en `catalog.ts`).
  `@repo/schemas/quotes`: contrato Zod (`createQuoteSchema`/`updateQuoteSchema` — mismo shape para
  ambos, reemplazo completo de líneas, sin mínimo de líneas a nivel Zod), **matriz de transiciones
  compartida** `QUOTE_STAGE_TRANSITIONS`/`canTransition` (incluye `confirmed→completed` aunque no haya
  router procedure que la dispare todavía — así Fase 5 solo agrega el procedure, no toca la matriz), y
  **`computeQuoteTotals`** (cascada exacta de `mach-bar-domain.md §7`, verificada contra el ejemplo
  numérico del doc). Módulo `quotes` (resource/repository/service/router, patrón `docs/backend/
architecture.md §9` + precedente de anidamiento de `products`): `list`/`getById`/`board` (`READ`,
  `board` gateado por `RESOURCES.PIPELINE` no `QUOTE`)/`create`/`update`/`updateStage`/`approve`/
  `cancel` (mutaciones de dominio gateadas por `UPDATE` del recurso `quote`, sin `ACTIONS` nuevas, como
  fija la sección de fundaciones). Reglas de negocio clave: **snapshot condicional** de
  `taxRate`/`depositRate`/`validUntil` (se re-calculan en `update` mientras `stage='new'`, quedan
  congeladas desde `'quoted'`); **`update` rechaza** quotes fuera de `{new, quoted}`
  (`QUOTE_NOT_EDITABLE`); **`updateStage→quoted` valida completitud** (`state`/`address`/≥1 línea,
  `QUOTE_INCOMPLETE`); **revalidación server-side de líneas** contra el catálogo vivo (tramo existe,
  opciones pertenecen a su grupo/producto y están activas, `maxSelect` no excedido — un solo
  `QUOTE_INVALID_LINES` cubre cualquier inconsistencia). `quote_lines`/`quote_line_options` se insertan
  con **ids generados en JS (`randomUUID`)** antes del insert, no vía `RETURNING`, para no depender del
  orden de filas devuelto por Postgres en un insert múltiple. Cerrados los **2 ganchos pendientes** de
  fases previas: `config.getLastUsedSeq()` (ahora `MAX(seq)` real) y `clients.status` derivado
  (`EXISTS` contra `quotes.stage IN ('confirmed','completed')`). **Bug propio + fix**: el primer
  intento de `clients.status` interpoló columnas en un `sql` template crudo
  (`` sql`... where ${quotes.clientId} = ${clients.id}` ``) — Postgres resolvió el `id` sin calificar
  contra la tabla **`quotes`** (que también tiene columna `id`) en vez de correlacionar con `clients`,
  así que todos los clientes daban `'lead'` aunque tuvieran quotes confirmadas. Fix: subquery armada
  con el query builder (`exists(db.select(...).from(quotes).where(and(eq(...), inArray(...))))`) en vez
  de interpolación cruda — el builder sí califica las columnas por tabla. Seeder `seedQuotes`: 8
  cotizaciones repartidas en `new`/`quoted`/`confirmed`/`cancelled` (no `completed`, inalcanzable sin
  `events`), resolviendo productos/tramos/opciones **por nombre** contra el catálogo ya seedeado (mismo
  criterio que el resto de los seeders). Verificado **en vivo por tRPC** (login superadmin real): CRUD
  completo, cascada de precio exacta, las 4 columnas del pipeline agrupan bien,
  `config.get().lastUsedSeq` refleja el máximo real, `clients.list` deriva `status` correctamente,
  ciclo de stage completo (`new→quoted` rechazado incompleto → completado → aprobado → doble-approve
  rechazado → cancelado → reabierto), validación de líneas (tramo inexistente y `maxSelect` excedido)
  rechazada, `update` sobre quote `confirmed` rechazado. `check-types` monorepo limpio, `db:fresh`
  limpio. **Pendiente**: las 3 superficies de FE (`/admin/quotes` lista, `/admin/quotes/new`+`/admin/
quotes/[id]` constructor, `/admin/pipeline` kanban) — plan completo en
  `/Users/sambar/.claude/plans/playful-crunching-cherny.md`.
- **2026-07-14** — **Rework de catálogo (D16/D17) implementado en código** (cierra la parte BE/FE del
  rework descrito abajo, pendiente solo el re-seed real): schema `product_price_tiers`
  (`numPersons/price` únicos por producto), `option_groups.selectionType` (enum `select`/`included`) +
  `maxSelect`, `options.description`; `@repo/schemas/catalog` con `priceTierSchema`/`productTiersSchema`
  (valida `numPersons` sin duplicados) y `updateProductTiersSchema`; módulo `products` con **sub-router
  nuevo `products.prices.*`** (`list`/`update` de tramos) además de los ya existentes
  `groups.*`/`options.*`. FE: `ProductForm` con tabla de tramos editable, `OptionGroupForm` con toggle
  `select`/`included` (+ `maxSelect` condicional), `OptionForm` con `description`. **Superficie nueva
  `/admin/prices`** (`PricesPage`/`PriceList`/`PricePanel`/`PriceTiersForm`, gateada por
  `PRODUCT`/`UPDATE`) para editar tramos de precio sin entrar al editor completo del catálogo — no
  estaba en `mach-bar-flows.md` original, surgió como necesidad operativa (el precio se actualiza más
  seguido que la estructura del catálogo). **Nuevo setting `app_settings.catalogSortable`** (default
  `true`): toggle en Settings → Preferences (`CatalogPreferencesCard`) que habilita/deshabilita el
  reorder manual (drag/flechas) del editor de catálogo (`useCatalogSortable` gatea `SortableList`); útil
  para bloquear el orden una vez definido. **Re-seed parcial**: `Mini Pancakes`, `Crepaletas` y
  `Esquites` ya tienen tabla de precios real (tramos de 30 a 150-400 personas, USD cents); el resto
  (`Crepes`, `Nachos`, `Fruit Station`, `Snack Station`, `Popsicles`, `Craft Bar`) sigue con
  `PLACEHOLDER_TIERS` genérico. Se sumó **`Hot Chocolate`** como estación nueva (no estaba en la lista
  original de 9), también con tramos placeholder. Verificado: `check-types` monorepo limpio, working
  tree limpio (todo comiteado en `dev`). **Pendiente para cerrar Fase 2**: tablas de precio reales de
  las 7 estaciones que faltan + decisión de modelo de precio de Craft Bar (fija vs. por hora).
- **2026-07-13** — **Refinamiento del catálogo (D16/D17)** tras revisar el Excel real del negocio. **Precio por tramo** (D16): se elimina `products.base_price` y `quote_lines.price_per_person`; nueva tabla **`product_price_tiers` (`numPersons → price`, price = total del tramo)**; en la quote se elige un tramo existente (dropdown, **solo tramos definidos**) y `price` pre-carga pero es **editable por línea**. **Tipos de grupo** (D17): **`option_groups.selection_type` (`select` | `included`)** — `select` = elige **hasta `max_select`** (sin mínimo, decisión del usuario); `included` = informativo, no se selecciona (ej. "Premium Syrups Included"). **`options.description`** opcional (ingredientes del cóctel del Craft Bar). "Special Dietary Requests" (idéntico en todas las estaciones) → **nota global**, no se duplica por producto. **Craft Bar** se modela como estación con `product_price_tiers` (a confirmar si es fija/horaria al cargar precios). **Docs canónicos actualizados**: `domain` (§2 D16/D17, §4 enum `option_group_type`, §5.1 `quote_lines`, §5.3 catálogo, §6 ER, §7 cascada), `model.dbml`, `flows` (§2 builder, §4 editor). **Pendiente (rework Fase 2)**: código de catálogo (schema Drizzle, `@repo/schemas/catalog`, módulo `products` resource/repo/router, forms FE `ProductForm`/`OptionGroupForm`/`OptionForm`) + **re-seed con datos reales** (el usuario pasa las tablas de precio por estación). Debe cerrar antes de Fase 4.
- **2026-07-13** — Configuración **BE+FE** hecho (**cierra Fase 3**), + re-verificado en vivo Fase 2 tras reinicio del dev server (`/admin/event-types` y `/admin/catalog` → HTTP 200 limpio, confirma que el 500 anterior era 100% caché de Next, no bug). **Guard `CONFIG` nuevo** (solo superadmin/admin, mismo patrón que ya tenían todos los recursos — `member` sigue sin permisos en ningún resource). Schema `state_settings` (PK `state`) + `app_settings` (singleton `id=1`) usando **`numeric(..., { mode: 'number' })` de Drizzle** (evita casteos string↔number manuales en resource/repo — primera vez que se usa `numeric` en el proyecto). Contrato Zod con tasas como decimal 0-1. Módulo `config`: `get`/`update` transaccional (upsert de ambos buckets), valida `quoteSeqStart` con `SEQUENCE_BELOW_LAST`; `getLastUsedSeq()` es un **placeholder que devuelve 0** (mismo patrón que `clients.status` en Fase 1 — se completa en Fase 4 cuando exista `quotes`). `configResource` expone `lastUsedSeq` como hint de solo lectura para el form. `seedConfig`: NY 8.875%/NJ 6.625%/CT 6.35% (tasas reales) + app_settings default (deposit 50%, validez 3 meses, min 30 personas, seq desde 1, USD). FE: fundación **`lib/percent`** (helper ×100/÷100) + **`lib/money`/`useMoneyFormatter` ahora con currency configurable** (pedido del usuario): `formatMoney` acepta `currency` como parámetro explícito, y `useMoneyFormatter` lo resuelve leyendo `config.get` en background (fallback silencioso a USD si no hay permiso o aún no cargó — vía comportamiento default de TanStack Query, sin código extra). Feature `settings` a medida (`mach-bar-flows.md §5`): `SettingsPage` con **2 cards en un solo `Form`** (`TaxRatesCard` + `QuoteDefaultsCard`, esta última con el **Select de moneda** nuevo), remonta por `key={updatedAt}` para refrescar `initialValues` tras guardar (gotcha de AntD Form). Nav: **`SETTINGS_ITEM` nuevo**, ítem propio (no en el grupo Catálogo, según spec), icono `Settings`, en la lista principal del sidebar. Verificado: `check-types` monorepo + `db:push`/`db:seed` + en vivo por tRPC (`get` con `lastUsedSeq:0`, `update` cambia tasas+currency y persiste, validación Zod de `quoteSeqStart` rechaza `<1`) + rutas HTTP 200 (`/admin/settings`, `/admin/catalog` con el nuevo `useMoneyFormatter` dependiente de config).
- **2026-07-13** — Tipos de evento **BE+FE** hecho (**cierra Fase 2** en código): **guard `EVENT_TYPE` nuevo**; schema `event_types` (`id/name/isActive/sortOrder`, sin timestamps); contrato Zod (sin `delete`); módulo estándar `eventTypes` (resource/repo/service/router) **sin mutación `delete`** (solo `toggleActive` — soft-delete puro, D14, igual que catálogo); error `EVENT_TYPE_ALREADY_EXISTS`/`NOT_FOUND` + i18n; `seedEventTypes` (Boda/Cumpleaños/Corporativo/Baby Shower/Aniversario/Graduación/Otro). FE: feature `event-types` (espejo de `staff` pero reemplazando la row-action `delete` por `toggleActive` dinámica activar/desactivar); se sumó al **grupo "Catálogo" ya existente** del nav (icono `CalendarHeart`); `route-access`; i18n `eventTypes.json` es/en. **Bug propio + fix**: la row-actions hook usa JSX (`icon: <PowerOff/>`) pero se creó como `.ts` en vez de `.tsx` → rompía el parser; renombrado. El create→delete rápido del archivo dejó la caché de webpack del dev server corrompida (`Module build failed`, no relacionado al código — `check-types` monorepo limpio); pendiente reiniciar `pnpm dev` para re-verificar `/admin/event-types` y `/admin/catalog` en vivo (el usuario lo hace).
- **2026-07-13** — Catálogo **FE** hecho (editor acordeón a medida, `mach-bar-flows.md §4`, **no** sigue la receta `DataTable`): **fundaciones nuevas** `formatMoney`/`useMoneyFormatter` (`apps/web/src/lib/money`, `Intl.NumberFormat` locale-aware es/en) y **dnd-kit** (`@dnd-kit/core|sortable|utilities`). Feature `catalog`: `useCatalog` (`products.catalog`), 3 grupos de mutation-hooks (`useProductMutations`/`useOptionGroupMutations`/`useOptionMutations`, invalidan con `trpc.products.pathFilter()`); árbol de 3 niveles `ProductPanel→OptionGroupPanel→OptionRow` (acordeón local, expand por componente) cada uno envuelto en `SortableList` (dnd-kit) + `ReorderControl` (**drag en desktop, ↑/↓ en móvil** vía `useIsDesktop`, per §4.4/§4.8); `moveItem` helper para el reorder por flechas. Reusa `DataTableRowActions` (no es DataTable, pero el dropdown ⋮ + confirm es genérico) para editar/activar-desactivar en cada nivel. `ProductForm` captura precio en **USD** y convierte a cents **solo al submit** (`Math.round(valor*100)`, frontera FE per domain §3). Nav: **grupo "Catálogo" nuevo** (icono `Package`) con ítem "Productos"; `route-access` `/admin/catalog`; i18n `catalog.json` es/en. Verificado: `check-types` monorepo + `/admin/catalog` renderiza (HTTP 200); mutaciones (create/reorder/toggleActive anidado) ya probadas en vivo por API en el paso BE. Visual (drag real, acordeón) → revisión humana en browser.
- **2026-07-13** — Catálogo **BE** hecho (primer módulo jerárquico, 3 tablas bajo un solo módulo `products`): **guard `PRODUCT` nuevo**; schema `products/option_groups/options` con FKs cascade, **sin timestamps** (fiel al domain §5.3); contrato Zod por nivel (`create/updateProductSchema`, `...OptionGroupSchema`, `...OptionSchema`) + `catalogReorderSchema`/`catalogToggleActiveSchema` compartidos. Módulo `products`: `resource.ts` shapea flat **y** arma el árbol (`buildProductTree`, in-memory desde 3 selects — catálogo chico, evita joins con columnas repetidas); `repository.ts` con queries planas + `reorder*` transaccional (`sortOrder = index` por hermano); `router.ts` con **sub-routers `products.groups.*` / `products.options.*`** (mapea a los 3 grupos de mutation-hooks del FE), todo gateado bajo el **recurso único `product`** (`mach-bar-flows.md §4.2`). `products.list` = solo activos (builder) vs `products.catalog` = incluye inactivos (editor) — mismo árbol, distinto filtro. Errores `PRODUCT_NOT_FOUND/ALREADY_EXISTS`, `OPTION_GROUP_NOT_FOUND`, `OPTION_NOT_FOUND` + i18n. `seedCatalog`: las 9 estaciones reales (Crepaletas, Crepes, Mini Pancakes, Nachos, Fruit Station, Esquites, Snack Station, Popsicles, Craft Bar★premium) con 12 secciones y 52 ítems. **Nota de diseño**: catálogo es **soft-delete puro** — no hay mutación `delete`, solo `toggleActive` (D6: options las referencian `quote_line_options`). Verificado: `check-types` monorepo + `db:push`/`db:seed` + **en vivo**: árbol anidado completo, `list` vs `catalog` filtran `isActive` correctamente, `reorder` transaccional, `groups.create`/`options.create` anidan bien.
- **2026-07-13** — Staff **FE** hecho + **Fase 1 completa**: feature `staff` (espejo de `clients`; `StaffForm` con `Switch` para `isActive`, reusa `AvatarUser`), **`STAFF_ITEM` de nav nuevo** (item + icono lucide `ChefHat` + grupo principal + `route-access /admin/staff`), página thin `/admin/staff`, i18n `staff.json` (es/en) + namespace. Verificado: `check-types` web + `/admin/staff` renderiza (HTTP 200) + CRUD ya validado por API en el paso BE. Visual desktop/móvil → revisión humana. **Además**: en el `DataTable` compartido, en móvil+card se desactivó el scroll horizontal y el `padding-inline` del `.ant-table-cell` (a pedido).
- **2026-07-13** — Staff **BE** hecho (módulo estándar): **guard `STAFF` nuevo** (`RESOURCES.STAFF` + ambas matrices, superadmin/admin CRUD), schema `staff` (`id/name/phone/email/isActive/createdAt`, **sin `updatedAt`** per domain §5.2), contrato Zod (`isActive` default true en create), módulo `staff` (resource/repo/service/router), error `STAFF_NOT_FOUND` + i18n, router registrado, `seedStaff` (7: 5 activos + 2 inactivos). Extraje helpers `optionalText`/`optionalEmail` a `@repo/schemas/fields` (reusados por clients+staff). Verificado: `check-types` monorepo + **CRUD end-to-end en vivo** (list/create/update-toggle/delete; default `isActive` y blanco→null OK). Delete es hard-delete (aún no hay FKs); `isActive` es el alta/baja operativo.
- **2026-07-13** — Clientes **FE** hecho (espejo de `users`): feature `clients` (types inferidos, hooks tRPC, `useClientRowActions`, `columns`/`ClientCard`/`ClientsTable`/`ClientForm`/modales/`ClientsPage` + barrel), página thin `/admin/clients` (reemplaza `PlaceholderPage`), i18n `clients.json` (es/en) + namespace registrado. Nav `CLIENTS_ITEM` y `route-access` ya existían. Verificado: `check-types` web + **CRUD end-to-end en vivo** (login superadmin → `list`/`create`/`update`/`delete` por tRPC; `status` derivado y normalización blanco→null OK). Visual desktop/móvil (card) → revisión humana en browser.
- **2026-07-13** — Clientes **BE** hecho (espejo de `users`): enum `state` compartido (DB `pgEnum` + Zod `@repo/schemas`), tabla `clients`, contrato Zod (create/update/listQuery + `status` derivado), módulo `clients` (resource/repo/service/router), `RESOURCES.CLIENT` (ya existía), error `CLIENT_NOT_FOUND` + i18n, router registrado, `seedClients` (10 leads NY/NJ/CT). `status` derivado = `'lead'` fijo en Fase 1 (se completa en Fase 4). Verificado: `check-types` (api+web) + `db:push` + `db:seed`.

---

## Orden de fases (por dependencias)

```
Fase 1  Clientes + Staff        (sin deps)            → valida el patrón de dominio
Fase 2  Catálogo + Tipos evento (sin deps)            → products/option_groups/options + event_types
Fase 3  Configuración           (sin deps)            → state_settings + app_settings
Fase 4  Cotizaciones            (deps: 1,2,3)         → quotes + quote_lines + quote_line_options
Fase 5  Eventos                 (deps: 4, staff)      → events + event_staff
Fase 6  Dashboard               (deps: todo)          → agregaciones
```

---

## Comandos

```bash
pnpm --filter api db:fresh        # reset + push + seed (reinicia la DB entera)
pnpm --filter api db:push         # aplica el schema (sin migraciones versionadas)
pnpm --filter api db:seed         # corre los seeders
pnpm --filter web check-types     # type-check web
pnpm check-types                  # type-check monorepo
pnpm dev                          # web:3000 + api
```

Flujo por módulo: schema → `db:push` (o `db:fresh`) → backend → seeder → `db:seed` → frontend → testear.
Como iteramos seeders, **`db:fresh`** es el reset de cabecera.

---

## Checklist genérico de un módulo estándar

Para features CRUD (clientes, staff, tipos de evento, y las **listas** de quotes/events). Los detalles
están en los arch docs; acá va el orden.

**Backend** (`docs/backend/architecture.md §9`)

- [ ] Schema Drizzle en `db/schema/<x>.ts` + reexport en el barrel.
- [ ] `@repo/schemas/src/<x>.ts`: `createXSchema`, `updateXSchema`, `xListQuerySchema` + reexport.
- [ ] `resource` → `repository` → `service` → `router`.
- [ ] Guards: `RESOURCES.X` + fila en el `rolesPermissionsMatrix` (si falta el recurso).
- [ ] Errores de dominio en `lib/errors` (si aplica).
- [ ] Registrar el router en `trpc/router.ts`.
- [ ] Seeder `db/seeds/<x>.ts` + registrar en `seeds/index.ts` (en orden de deps).

**Frontend** (`docs/frontend/architecture.md §13`)

- [ ] `types.ts` (inferido de `RouterOutputs`).
- [ ] `hooks/useX.ts` (`useXList`/`useCreateX`/`useUpdateX`/`useDeleteX`) + `useXRowActions`.
- [ ] `columns.tsx` · `XCard` · `XTable` · `XForm` · `Create/EditXModal` · `XPage` + barrel.
- [ ] **Estados de carga**: `Skeleton` en primera carga (página/tabla/detalle/form), `Spin` en acciones/refetch (`docs/frontend/architecture.md §11`).
- [ ] Página thin `app/admin/<x>/page.tsx`.
- [ ] i18n `locales/{es,en}/<x>.json` + registrar namespace; nav labels en `admin`.
- [ ] Nav item en `lib/navigation` (item + icono lucide + grupo) + `route-access.ts`.
- [ ] Gatear acciones con `<Can>`/`useCan`.

**Checkpoint** (cada módulo): `db:fresh` → login → la pantalla lista/crea/edita/borra OK + `check-types` limpio.

> Las **superficies a medida** (editor de catálogo, settings, builder, pipeline, detalles, dashboard)
> **no** siguen esta receta — su diseño está en `mach-bar-flows.md`.

---

## Fundaciones transversales (se introducen just-in-time)

| Fundación               | Qué                                                                                                                                                                        | Entra en                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Guards nuevos**       | `RESOURCES`: `STAFF`, `PRODUCT`, `EVENT_TYPE`, `CONFIG` + filas en `rolesPermissionsMatrix` (superadmin/admin = CRUD). `CLIENT/EVENT/QUOTE/PIPELINE/DASHBOARD` ya existen. | Fase 1–3                        |
| **Enums compartidos**   | `state` (NY/NJ/CT) en `@repo/schemas`; reusado por clients, quotes, events, state_settings.                                                                                | Fase 1                          |
| **Dinero en centavos**  | Utils de cents + `computeQuoteTotals` en paquete compartido; `formatMoney` de display en `apps/web/src/lib`.                                                               | cents: Fase 2 · compute: Fase 4 |
| **Porcentajes**         | Helper `%` ↔ decimal (×100 / ÷100) para tasas.                                                                                                                             | Fase 3                          |
| **dnd-kit**             | Dependencia para reordenar (catálogo) y kanban (pipeline).                                                                                                                 | Fase 2                          |
| **Acciones de dominio** | `approve`/`updateStage`/`assignStaff`/`markCompleted` → gatean por el `UPDATE` del recurso padre (no hay ACTIONS nuevas).                                                  | Fase 4–5                        |

---

## Fase 1 — Clientes + Staff

Sin dependencias. Son features **estándar** (espejo de `users`); su objetivo es **fijar el patrón** de dominio.

### 1a. Clientes

- **BE**: schema `clients` + `@repo/schemas/clients` + módulo (resource/repo/service/router). Guard `CLIENT` (ya existe).
- **FE**: feature `clients` estándar. Nav `CLIENTS_ITEM` (ya existe) → `/admin/clients`.
- **Seeder**: `seedClients` (varios leads + algún active).
- ⚠️ **`clients.status` derivado** (lead/active) **depende de quotes** → en Fase 1 queda como `lead` para todos (o columna omitida). Se completa en **Fase 4**.

### 1b. Staff

- **BE**: schema `staff` + schemas + módulo. **Guard `STAFF` nuevo** (+ roles matrix).
- **FE**: feature `staff` estándar. **Nav `STAFF_ITEM` nuevo** (item + icono + route-access) → `/admin/staff`.
- **Seeder**: `seedStaff`.

**Checkpoint**: `db:fresh`; `/admin/clients` y `/admin/staff` con CRUD completo en desktop y móvil (card).

---

## Fase 2 — Catálogo maestro + Tipos de evento

Sin dependencias. Introduce **cents** (`formatMoney`) y **dnd-kit**.

### 2a. Catálogo (`products → { product_price_tiers, option_groups → options }`) — modelo D16/D17

- **BE**: schema (products **sin `base_price`** + **`product_price_tiers`** `numPersons→price` cents +
  `option_groups` con **`selection_type`** `select`/`included` + `options` con **`description`**) +
  `@repo/schemas/catalog`. Módulo `products`: read anidado `products.catalog` (`includeInactive`, incluye
  tramos) para el editor, `products.list` (solo activos) para el builder, y mutaciones
  create/update/**toggleActive**/**reorder** por nivel + **CRUD de tramos** (`products.tiers.*`).
  **Guard `PRODUCT`** (ya existe).
- **FE**: feature `catalog` **a medida** (acordeón, `mach-bar-flows.md §4`): soft-delete (activar/desactivar),
  **reorder por drag** (dnd-kit) desktop / ↑↓ móvil. `ProductForm` con **tabla de tramos**;
  `OptionGroupForm` con toggle `select`/`included` (+ `maxSelect` solo en `select`); `OptionForm` con
  `description`. Nav grupo **Catálogo → Productos** (`/admin/catalog`). `formatMoney`.
- **Seeder**: `seedCatalog` — las estaciones reales con sus **tablas de tramos** (Excel), grupos
  (`select`/`included`) e ítems. Craft Bar con sus cócteles (`description`). **Datos pendientes** de que
  el usuario pase las tablas de precio por estación.

### 2b. Tipos de evento

- **BE**: schema `event_types` + schemas + módulo estándar. **Guard `EVENT_TYPE` nuevo**.
- **FE**: feature `eventTypes` **estándar** (DataTable) con soft-delete. Nav **Catálogo → Tipos de evento**
  (`/admin/event-types`).
- **Seeder**: `seedEventTypes` (Boda, Cumpleaños, Corporativo…).

**Checkpoint**: `db:fresh`; editar catálogo (crear/reordenar/desactivar) y `/admin/event-types` CRUD.

---

## Fase 3 — Configuración

Sin dependencias. Introduce el helper de **porcentajes**. **Debe quedar antes de Fase 4** (las cotizaciones
leen tax/deposit/validez/seq de acá).

- **BE**: schema `state_settings` (seed NY/NJ/CT) + `app_settings` (singleton). Módulo `config`:
  `config.get` + `config.update` (upsert ambos buckets; **valida `quoteSeqStart ≥ último seq`**). **Guard `CONFIG`
  nuevo** (solo admin/superadmin). Error `SEQUENCE_BELOW_LAST`.
- **FE**: feature `settings` **a medida** (form de 2 cards, `mach-bar-flows.md §5`). `%` ↔ decimal. Nav
  **`SETTINGS_ITEM` nuevo** (`/admin/settings`, solo admin).
- **Seeder**: `seedConfig` — 3 filas `state_settings` con tax real + 1 `app_settings` (deposit 0.5, validez 3,
  minPersons 30, seqStart 1).

**Checkpoint**: `db:fresh`; `/admin/settings` guarda tasas y defaults; validación de seq.

---

## Fase 4 — Cotizaciones

Deps: **clientes, catálogo, config, event_types**. La fase más grande.

- **Shared**: `computeQuoteTotals(input, config)` en paquete compartido (usa cents; lo consumen preview, BE y PDF).
  Con D16, cada línea aporta su `price` (total del tramo, editable) → `subtotal = Σ line.price` (sin `× numPersons`).
- **BE**: schema `quotes` + `quote_lines` + `quote_line_options` + `@repo/schemas/quotes` (create con líneas/opciones).
  Módulo `quotes`: create/update (calcula cascada en cents, **snapshot** de tasas/validUntil, asigna `seq`/`number`),
  `list` (filtros month/status/state/clientId), **`board`** (agrupado por stage), `updateStage`/`approve`/`cancel`
  con la **matriz de transiciones** compartida (revalidada en server). Guards `QUOTE`/`PIPELINE` (ya existen).
  - ⚠️ **`approve` NO crea el evento todavía** (events es Fase 5): por ahora solo `stage→confirmed`. Se completa en Fase 5.
  - ✅ Completar el **`clients.status` derivado** (ya existen quotes).
- **FE**: **constructor** a medida (`§2`: builder local + preview + `computeQuoteTotals` + guardar-borrador/enviar +
  alta inline de lead), **pipeline** a medida (`§3`: dnd-kit + optimistic; el botón _asignar staff_ queda inerte
  hasta Fase 5), y **lista** de quotes estándar. Nav `QUOTES`/`PIPELINE` (ya existen).
- **Seeder**: `seedQuotes` — cotizaciones en varios stages (draft/quoted/confirmed) para poblar el pipeline.

**Checkpoint**: `db:fresh`; armar una cotización (preview = guardado), verla en `/admin/quotes`, mover cards en el pipeline.

---

## Fase 5 — Eventos

Deps: **cotizaciones, staff**.

- ✅ **BE**: schema `events` + `event_staff` + `@repo/schemas/events`. Módulo `events`: `getById` (con la composición
  **leída de la quote**), `list` (filtros), `assignStaff`/`removeStaff`, `markCompleted`, `updatePayment`
  (deposit/balance/method). `staff.getAvailability`. Guard `EVENT` (ya existía).
  - ✅ **Completar `quotes.approve`**: al confirmar, **inserta el evento** (snapshot escalar de la quote; `quote_id` unique).
- ✅ **FE**: calendario real (`Calendar` de AntD + `cellRender`) en el tab "Calendario", **detalle de evento** a
  medida (`§6`), y `AssignStaffModal` compartido (activa el botón del pipeline de Fase 4). Nav `EVENTS` (ya existía).
  - ✅ **Ficha de cliente 360** (`§7`): `/admin/clients/[id]` (header + tabs Cotizaciones/Eventos).
- ✅ **Seeder**: `seedEvents` (eventos desde quotes confirmadas + asignaciones de staff).

**Checkpoint** ✅: `db:fresh`; aprobar una quote crea el evento; detalle con pagos y staff; ficha de cliente con historial.

---

## Fase 6 — Dashboard

Deps: **todo**. Cierra el círculo con lecturas agregadas.

- **BE**: módulo `dashboard` (solo `query`, sin CRUD/Paginated): `summary`, `upcomingEvents`, `topProducts`,
  `quotesByMonth`. Guard `DASHBOARD` (ya existe).
- **FE**: `DashboardPage` a medida (`§8`): 4 MetricCards + gráfica (elegir lib — **Recharts** recomendada) +
  próximos eventos + top productos. Nav `DASHBOARD` (ya existe).

**Checkpoint**: `db:fresh` con datos de todas las fases; métricas del mes coherentes.

---

## Notas de secuenciación (dependencias que se “completan” después)

- **`clients.status`** derivado (lead/active) → se completa en **Fase 4** (necesita quotes).
- **`quotes.approve` → crea evento** → se completa en **Fase 5** (necesita events).
- **Pipeline “asignar staff”** → funcional en **Fase 5** (necesita `events.assignStaff`).
- **Ficha de cliente 360** → **Fase 5** (necesita quotes + events).
- **Config seedeada** → antes de **Fase 4** (las quotes leen tax/deposit/validez/seq).
