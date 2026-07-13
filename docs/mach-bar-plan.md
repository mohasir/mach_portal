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

| Doc | Rol |
|---|---|
| `mach-bar-domain.md` | **Modelo de datos** (canónico): tablas, enums, decisiones D1–D15, precio en cents, estados, RBAC. |
| `mach-bar-model.dbml` | ER para dbdiagram.io (nombres genéricos). |
| `mach-bar-flows.md` | **Flujos de front** (canónico): las 8 superficies (§2–§8). |
| `mach-bar-plan.md` | **Este doc**: plan de ejecución + progreso. |
| `mach-bar-specs.md` | Spec original (raw). **Superado** por domain/flows; queda como insumo histórico. |
| `docs/backend/architecture.md` · `docs/frontend/architecture.md` · `docs/frontend/styling-guide.md` | Patrón estricto de BE/FE/estilos. |

**Canónico = `domain` + `model` + `flows`.** Ante conflicto con `mach-bar-specs.md`, mandan los refinados.

---

## Estado / progreso (resumible entre sesiones)

> **Cómo retomar en una sesión nueva:** (1) leé los docs canónicos de arriba; (2) mirá la tabla y el
> **Próximo paso**; (3) continuá desde ahí. **Actualizá esta sección** al cerrar cada tarea: marcá ✅,
> movés el "Próximo paso" y agregás una línea a la bitácora.

**Última actualización:** 2026-07-13 · **Fase actual:** Fase 1 (Clientes + Staff) · **Próximo paso:** Fase 1 → Staff (FE).

Leyenda: ☐ pendiente · 🔨 en progreso · ✅ hecho

| Fase | Módulo | BE | FE | Seeder | Checkpoint |
|---|---|:--:|:--:|:--:|:--:|
| 1 | Clientes | ✅ | ✅ | ✅ | ✅ |
| 1 | Staff | ✅ | ☐ | ✅ | ☐ |
| 2 | Catálogo | ☐ | ☐ | ☐ | ☐ |
| 2 | Tipos de evento | ☐ | ☐ | ☐ | ☐ |
| 3 | Configuración | ☐ | ☐ | ☐ | ☐ |
| 4 | Cotizaciones | ☐ | ☐ | ☐ | ☐ |
| 5 | Eventos | ☐ | ☐ | ☐ | ☐ |
| 6 | Dashboard | ☐ | ☐ | ☐ | ☐ |

**Fundaciones** (transversales): guards nuevos 🔨 (`STAFF` ✅; falta `PRODUCT`/`EVENT_TYPE`/`CONFIG`) · enum `state` compartido ✅ · cents + `formatMoney` ☐ · `%` helper ☐ · dnd-kit ☐ · `computeQuoteTotals` ☐

**Bitácora de sesión** (lo último arriba):
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

| Fundación | Qué | Entra en |
|---|---|---|
| **Guards nuevos** | `RESOURCES`: `STAFF`, `PRODUCT`, `EVENT_TYPE`, `CONFIG` + filas en `rolesPermissionsMatrix` (superadmin/admin = CRUD). `CLIENT/EVENT/QUOTE/PIPELINE/DASHBOARD` ya existen. | Fase 1–3 |
| **Enums compartidos** | `state` (NY/NJ/CT) en `@repo/schemas`; reusado por clients, quotes, events, state_settings. | Fase 1 |
| **Dinero en centavos** | Utils de cents + `computeQuoteTotals` en paquete compartido; `formatMoney` de display en `apps/web/src/lib`. | cents: Fase 2 · compute: Fase 4 |
| **Porcentajes** | Helper `%` ↔ decimal (×100 / ÷100) para tasas. | Fase 3 |
| **dnd-kit** | Dependencia para reordenar (catálogo) y kanban (pipeline). | Fase 2 |
| **Acciones de dominio** | `approve`/`updateStage`/`assignStaff`/`markCompleted` → gatean por el `UPDATE` del recurso padre (no hay ACTIONS nuevas). | Fase 4–5 |

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

### 2a. Catálogo (`products → option_groups → options`)
- **BE**: schema de las 3 tablas + `@repo/schemas/catalog` (product/group/option create/update). Módulo `products`:
  read anidado `products.catalog` (`includeInactive`) para el editor, `products.list` (solo activos) para el
  builder, y mutaciones create/update/**toggleActive**/**reorder** por nivel. `basePrice` en **cents**.
  **Guard `PRODUCT` nuevo**.
- **FE**: feature `catalog` **a medida** (acordeón, `mach-bar-flows.md §4`): soft-delete (activar/desactivar),
  **reorder por drag** (dnd-kit) desktop / ↑↓ móvil. Nav grupo **Catálogo → Productos** (`/admin/catalog`).
  Introducir `formatMoney`.
- **Seeder**: `seedCatalog` — las 9 estaciones reales con sus secciones (maxSelect) e ítems.

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
- **BE**: schema `quotes` + `quote_lines` + `quote_line_options` + `@repo/schemas/quotes` (create con líneas/opciones).
  Módulo `quotes`: create/update (calcula cascada en cents, **snapshot** de tasas/validUntil, asigna `seq`/`number`),
  `list` (filtros month/status/state/clientId), **`board`** (agrupado por stage), `updateStage`/`approve`/`cancel`
  con la **matriz de transiciones** compartida (revalidada en server). Guards `QUOTE`/`PIPELINE` (ya existen).
  - ⚠️ **`approve` NO crea el evento todavía** (events es Fase 5): por ahora solo `stage→confirmed`. Se completa en Fase 5.
  - ✅ Completar el **`clients.status` derivado** (ya existen quotes).
- **FE**: **constructor** a medida (`§2`: builder local + preview + `computeQuoteTotals` + guardar-borrador/enviar +
  alta inline de lead), **pipeline** a medida (`§3`: dnd-kit + optimistic; el botón *asignar staff* queda inerte
  hasta Fase 5), y **lista** de quotes estándar. Nav `QUOTES`/`PIPELINE` (ya existen).
- **Seeder**: `seedQuotes` — cotizaciones en varios stages (draft/quoted/confirmed) para poblar el pipeline.

**Checkpoint**: `db:fresh`; armar una cotización (preview = guardado), verla en `/admin/quotes`, mover cards en el pipeline.

---

## Fase 5 — Eventos

Deps: **cotizaciones, staff**.

- **BE**: schema `events` + `event_staff` + `@repo/schemas/events`. Módulo `events`: `getById` (con la composición
  **leída de la quote**), `list` (filtros), `assignStaff`/`removeStaff`, `markCompleted`, `updatePayment`
  (deposit/balance/method). `staff.getAvailability`. Guard `EVENT` (ya existe).
  - ✅ **Completar `quotes.approve`**: al confirmar, **inserta el evento** (snapshot escalar de la quote; `quote_id` unique).
- **FE**: **lista** de eventos estándar, **detalle de evento** a medida (`§6`), y `AssignStaffModal` compartido
  (activa el botón del pipeline de Fase 4). Nav `EVENTS` (ya existe).
  - **Ficha de cliente 360** (`§7`): ahora que existen quotes+events, se arma `/admin/clients/[id]` (header + tabs).
- **Seeder**: `seedEvents` (eventos desde quotes confirmadas + asignaciones de staff).

**Checkpoint**: `db:fresh`; aprobar una quote crea el evento; detalle con pagos y staff; ficha de cliente con historial.

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
