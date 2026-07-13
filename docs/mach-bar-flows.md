# Mach Bar — Flujos de front (refinado)

> Detalle de las **superficies de front** del portal. Complementa `mach-bar-domain.md` (modelo de
> datos) y se apoya en `docs/frontend/architecture.md` (cómo se construye una feature) y
> `docs/frontend/styling-guide.md` (visual). Este doc define **cómo se comportan** las pantallas.
>
> Convenciones que aplican a TODA superficie (custom incluida): mobile-first, AntD v6 + Tailwind,
> iconos `lucide-react`, fechas con `useDateFormatter`, i18n en todo texto, `useCan`/`<Can>` para
> permisos, **estados de carga con `Skeleton`/`Spin` según el caso** (`docs/frontend/architecture.md §11`).
> El límite de autorización real es la API.

---

## 1. Inventario de superficies

Dos categorías (ver `mach-bar-domain.md §10`):

- **Features estándar** (patrón `DataTable` + card + modales CRUD): `clients`, `staff`, `events`
  (lista), `quotes` (lista), y los lookups administrables (`event_types`, catálogo).
- **Superficies a medida** (diseño propio): constructor de cotización (§2), pipeline kanban (§3),
  editor de catálogo (§4), configuración (§5), detalle de evento (§6), ficha de cliente (§7),
  dashboard (§8).

Todas las superficies quedan detalladas en este doc (§2–§8).

---

## 2. Constructor de cotización — `/admin/quotes/new`

Form **multi-entidad con preview en vivo**, en 2 columnas (desktop): formulario a la izquierda,
documento armándose en tiempo real a la derecha. El armado es **estado local efímero** (no TanStack
Query); solo el catálogo, `event_types` y la config son server-state cacheado. Los totales se
calculan localmente para el preview, pero **el servidor recalcula y es la autoridad** al guardar.

### 2.1 Fuentes de datos (server-state, cacheado)

```ts
useProductCatalog()  // trpc.products.list    → products + option_groups + options (armado y prefill de precio)
useEventTypes()      // trpc.eventTypes.list  → lookup del <Select> de tipo de evento
useConfig()          // trpc.config.get       → taxRate por estado, depositRate default, minPersons, validityMonths
```

### 2.2 Estado del builder (cliente, efímero)

```ts
interface QuoteBuilderState {
  clientId: string | null;              // cliente elegido o recién creado inline (§2.6)
  eventTypeId: string | null;
  eventDate: string | null; eventTime: string | null;
  state: 'NY' | 'NJ' | 'CT' | null;
  address: string; notes: string;
  lines: LineDraft[];
  discountType: 'fixed' | 'percent' | null;
  discountValue: number | null;         // cents si fixed, % si percent
  depositRate: number;                  // default de config, editable
}

interface LineDraft {                    // una línea de la quote (UI Mach Bar: una "Estación")
  productId: string;
  numPersons: number;                   // min = config.minPersonsPerLine
  pricePerPerson: number;               // cents, precargado de basePrice, editable
  selections: Record<string, string[]>; // optionGroupId → optionId[]
}
```

`useReducer` dentro de **`useQuoteBuilder`**, expuesto por un **`QuoteBuilderProvider` (context)** para
que form, panel de precio y preview lean el mismo estado sin prop-drilling. Se resetea al desmontar.
(Zustand sin persist queda como alternativa si más adelante se quiere autosave de borrador local.)

### 2.3 Cálculo de totales — función compartida FE/BE (decisión)

La cascada de precio (`mach-bar-domain.md §7`) vive en **una función pura en paquete compartido**
(`@repo/schemas` o un `@repo/pricing`):

```ts
computeQuoteTotals(input, config) → { subtotal, discountAmount, taxRate, taxAmount, total, depositAmount } // cents
```

La usan **el preview, el `quotes.create/update` del backend y el payload del PDF**. Garantiza que
**preview = lo guardado = PDF**. Todo en centavos, con redondeo explícito en los pasos de tasa.

### 2.4 Árbol de componentes (feature `quotes`)

```
features/quotes/
  components/builder/
    QuoteBuilderPage.tsx      // orquesta; layout 2-col (form | preview sticky)
    ClientSection.tsx         // combobox de cliente + alta inline de lead (§2.6)
    EventSection.tsx          // eventType, date, time, state, address  (AntD Form)
    LineBuilder/
      index.tsx               // lista de LineDraft + "Agregar línea"
      ProductPicker.tsx       // elegir un product del catálogo
      LineCard.tsx            // colapsable: personas, precio/persona, grupos de opciones
      OptionGroupChips.tsx    // chips con contador "3/7" y bloqueo por maxSelect
    PricingPanel.tsx          // descuento (type+value); muestra tax/depósito/total en vivo
    QuotePreview/index.tsx    // documento en vivo (espeja el PDF)
  hooks/
    useQuoteBuilder.ts        // reducer + acciones + totales derivados + isValid
    useProductCatalog.ts · useEventTypes.ts · useConfig.ts
    useQuotes.ts              // useCreateQuote / useUpdateQuote / useSendQuote / useGenerateQuotePdf
```

### 2.5 Persistencia — borrador + enviar (decisión)

Dos acciones, ambas persisten:

```
/quotes/new
  [Guardar borrador] → quotes.create(input)            → quote en stage 'new' (aparece en pipeline)
                       → redirect a /admin/quotes/[id] (pasa a modo edición)
  [Enviar]           → create (si hace falta) + transición new→quoted   (requiere isValid)

/quotes/[id]  (editable solo si stage ∈ {new, quoted})
  edición            → quotes.update(id, input)
  [Enviar]  (si new) → new→quoted
  [Descargar PDF]    → quotes.generatePdf(id) → URL   (solo sobre quote persistida)
  [Aprobar]          → confirmed (crea evento)  — normalmente desde el pipeline
```

Se puede dejar una cotización a medias en `new` (borrador) sin enviarla; ya figura en el tablero.

### 2.6 Cliente — combobox + alta inline de lead (decisión)

`ClientSection` es un combobox (`Select showSearch`, búsqueda debounced contra `clients.list`) que
además ofrece **"+ Nuevo lead"**: abre un mini-form (nombre + teléfono mínimos) → `clients.create`
(status derivado = lead) → lo selecciona. Cubre el caso real de cotizar a alguien que recién llamó,
sin salir del builder.

### 2.7 Interacciones clave

- **Agregar línea** → `ProductPicker` toma un product del catálogo; nace un `LineDraft` con
  `pricePerPerson = basePrice` y `numPersons = minPersons`.
- **Chips por grupo** (`OptionGroupChips`): al llegar a `maxSelect`, los chips no elegidos se
  **deshabilitan** (límite UX en vivo; el server revalida). `maxSelect = null` → sin tope.
- **Editar personas/precio** → recalcula el subtotal de la línea y el total global al instante.
- **Cambiar `state`** → recarga el `taxRate` de config y recomputa el impuesto en vivo.

### 2.8 Validación (`isValid`)

Habilita "Enviar": ≥1 línea, cada `numPersons ≥ minPersons`, `clientId` + `state` + `address`
presentes. Espeja `createQuoteSchema` de `@repo/schemas`; las `rules` de AntD son solo UX, el backend
es el límite real. "Guardar borrador" es más laxo (permite incompletos).

### 2.9 Guardar

El FE manda **inputs** (personas, precio, selecciones, descuento) — **nunca** los montos. El server
corre `computeQuoteTotals`, **snapshotea** `taxRate`/`depositRate`/`validUntil`, asigna `seq`/`number`
e inserta `quotes + quote_lines + quote_line_options`.

### 2.10 Móvil (mobile-first)

Las 2 columnas no entran. En móvil: **una sola columna** (form) con una **barra fija inferior** que
muestra el **total** y un botón "Ver preview" que abre el documento en un **Drawer**. El preview no
se pierde, pero no compite por espacio.

### 2.11 Edición

`/admin/quotes/[id]` reusa el mismo builder hidratando el estado desde la quote, **solo si
`stage ∈ {new, quoted}`**. Desde `confirmed` la quote es read-only (`mach-bar-domain.md §D9/D13`).

---

## 3. Pipeline kanban — `/admin/pipeline`

Tablero de 5 columnas (las etapas de `quote.stage`) donde **cada card = una cotización/oportunidad**
(`mach-bar-domain.md §9`). Drag & drop con **dnd-kit**. AntD no trae kanban, así que es superficie a
medida.

### 3.1 Datos — endpoint dedicado (no paginado)

El tablero necesita las quotes **agrupadas por stage**, no una lista paginada:

```ts
usePipelineBoard(filters)  // trpc.quotes.board → { new: Card[], quoted: [], confirmed: [], completed: [], cancelled: [] }
```

- Columnas **abiertas** (`new`/`quoted`/`confirmed`) cargan completas: son deals activos, acotados por
  naturaleza.
- Columnas **terminales** (`completed`/`cancelled`) se **limitan por ventana** (default: mes actual)
  para que no crezcan sin techo; selector de rango arriba + "ver más".
- Cada card es una **proyección liviana** (`QuoteCardResource`), no la quote completa:
  `id, number, clientName, eventTypeName, eventDate, total, stage, validUntil, linesCount`,
  y en `confirmed`: `staffAssignedCount`, `depositPaid`.

### 3.2 Matriz de transiciones (fuente compartida FE/BE)

No todo drag es válido. La matriz vive en **constante compartida** (`@repo/schemas`) y el **service la
revalida** — la UI solo da la affordance:

| desde ↓ \ a → | new | quoted | confirmed | completed | cancelled |
|---|:---:|:---:|:---:|:---:|:---:|
| **new** | — | ✅ enviar | — | — | ✅ cancelar |
| **quoted** | — | — | ✅ aprobar\* | — | ✅ cancelar |
| **confirmed** | — | — | — | ✅ realizar | ✅ cancelar |
| **completed** | — | — | — | — | — (terminal) |
| **cancelled** | — | ✅ reabrir | — | — | — |

Efectos de cada transición:
- **enviar** (`→quoted`): sin efecto de datos (opcional: marcar fecha de envío).
- **aprobar** (`→confirmed`): `quotes.approve` → **crea el evento** (`mach-bar-domain.md §11`). Pide
  **confirm** y, al éxito, ofrece asignar staff (§3.5).
- **realizar** (`→completed`): marca el evento realizado.
- **cancelar** (`→cancelled`): pide confirm.
- **reabrir** (`cancelled→quoted`).

Al drag, solo las columnas destino válidas se resaltan; un drop inválido hace **snap-back**. El camino
es **lineal**: `new → quoted → confirmed` (no se salta `quoted`; para aprobar hay que haber enviado).
Salir de `confirmed` hacia atrás está **prohibido**: para **des-confirmar** se **cancela** (lo que
cancela también el evento derivado). Reabrir solo desde `cancelled → quoted`.

### 3.3 DnD (dnd-kit) + optimistic

- `DndContext` envuelve el board; cada `PipelineColumn` es `useDroppable`, cada `QuoteCard` es
  `useDraggable`. **No** hay orden manual dentro de la columna (ordena por `eventDate`/`validUntil`),
  así que no se persiste posición — solo el cambio de columna.
- `onDragEnd`: si cambió de stage y la transición es válida → mutación con **optimistic update**
  (mover la card ya en el cache de `quotes.board`; `onError` rollback + `useApiError`; `onSettled`
  invalidar). Las transiciones con efecto (aprobar/cancelar) confirman **antes** de mutar.
- Mutaciones: `quotes.updateStage` (transiciones sin efecto), `quotes.approve`, `quotes.markCompleted`,
  `quotes.cancel`. **El server revalida la matriz** (la UI no es el límite).

### 3.4 Card — contenido y badges

`number` · nombre de cliente · fecha (date-fns) · tag de tipo · `total` (`formatMoney`) · nº líneas.
- **`quoted`**: badge **"vencida"** si `validUntil < hoy` (derivado, `mach-bar-domain.md §9`); no es columna.
- **`confirmed`**: avatares de staff asignado + botón "Asignar" (§3.5); indicador de depósito pagado.

### 3.5 Asignar staff (en `confirmed`)

Botón en la card → `AssignStaffModal`: `staff.getAvailability({ date: eventDate })` (staff sin evento
ese día) → seleccionar → `events.assignStaff`. Se reusa en el detalle de evento (§5).

### 3.6 Móvil (mobile-first)

El kanban horizontal no funciona con drag táctil. En móvil: **`Segmented`/tabs por stage** (una
columna a la vez) y el movimiento se hace con un **menú de acción en la card ("Mover a…")** en vez de
drag — usa las mismas mutaciones/matriz. Desktop = kanban con drag; móvil = tabs + acción.

### 3.7 Permisos

Drag y acciones se gatean con `useCan` (`quote.updateStage`, `quote.approve`, `event.assignStaff`).
Sin permiso: card no arrastrable / acción oculta.

### 3.8 Componentes (feature `quotes`)

```
features/quotes/components/pipeline/
  PipelineBoard.tsx     // DndContext + filtros; desktop kanban / móvil tabs
  PipelineColumn.tsx    // droppable por stage + contador + lista
  QuoteCard.tsx         // draggable: datos + badges + acciones
  AssignStaffModal.tsx  // getAvailability → assignStaff (reusado en detalle de evento)
hooks/
  usePipelineBoard.ts   // quotes.board + optimistic updateStage/approve/cancel/markCompleted
```

---

## 4. Editor de catálogo — `/admin/catalog`

Donde el admin define el **"menú" del negocio**: qué `products` existen (precio, premium), qué
`option_groups` tiene cada uno (con `maxSelect`) y qué `options` hay en cada grupo. Es la
**contraparte** del constructor (§2): el editor define **QUÉ existe**; el builder lo **USA**.

Vive en el grupo **Catálogo** del sidebar:

```
Catálogo
 ├── Productos        /admin/catalog       → editor jerárquico (esta sección)
 └── Tipos de evento  /admin/event-types   → lista plana (feature estándar, §4.7)
```

Etiquetas i18n en Mach Bar: `product` = "Estación", `option_group` = "Sección", `option` = "Ítem".

### 4.1 Layout — árbol acordeón (mobile-first)

Una sola pantalla: lista de productos, cada uno se expande a sus grupos, cada grupo a sus opciones.
Todo en una columna que colapsa (no hay pantallas separadas de "grupos" u "opciones": solo existen
**dentro** de su producto).

```
Catálogo                                          [+ Producto]

▾ 🍦 Crepaletas         $12.00/pers  ★Premium  ● activo    ⋮
    ▾ Toppings (máx 7)                          ● activo   ⋮   [+ opción]
         ⠿ Chispas          ● activo   ⋮
         ⠿ Oreo             ● activo   ⋮
    ▾ Frutas (máx 2)                            ● activo   ⋮   [+ opción]
         ⠿ Fresa            ● activo   ⋮
    [+ grupo]

▸ 🥞 Mini Pancakes      $10.00/pers            ● activo    ▸ 🧀 Nachos  ○ inactivo
```

`▾/▸` expandir · `⠿` handle de arrastre · `⋮` menú (editar / desactivar / reordenar) · `●/○` activo/inactivo.

### 4.2 Operaciones por nivel

- **Producto**: crear, editar (nombre, descripción, `basePrice`, `isPremium`), activar/desactivar, reordenar.
- **Grupo** (`option_group`): crear (bajo un producto), editar (`label`, `maxSelect`), activar/desactivar, reordenar.
- **Opción** (`option`): crear (bajo un grupo), editar (nombre), activar/desactivar, reordenar.

Cada uno con su modal (`AntD Form`), gateado con `useCan` (recurso `product`).

### 4.3 Soft-delete siempre (decisión)

Nunca `DELETE` → **"Desactivar"** (`is_active=false`). Los referencian `quote_line_options` por FK
viva (D6/D15), así que no se borran. Los inactivos se muestran grises con **"Reactivar"** y
**desaparecen del builder** (que solo lista activos, §2.1).

### 4.4 Reordenar (decisión) — es `sort_order`, no la FK

La **FK** dice *a quién pertenece* algo; **no** su orden entre hermanos (la DB no garantiza orden sin
`ORDER BY`). El `sort_order` es la **posición de presentación** — la que se ve en el builder y en el
**PDF** (ej. Frutas antes que Toppings). "Reordenar" = **drag** (dnd-kit sortable) que actualiza el
`sort_order` de los hermanos de ese nivel; una mutación `reorder` por nivel. Es puramente visual.
Desktop = drag; **móvil = ↑/↓** (drag táctil en árbol es incómodo).

### 4.5 Datos — el editor trae TODO

`useCatalog()` → `products.catalog` (anidado, `includeInactive: true`): productos + grupos + opciones,
activos **e** inactivos. Distinto del builder, que usa `products.list` (solo activos).

### 4.6 Componentes (feature `catalog`)

```
features/catalog/components/
  CatalogPage.tsx        // lista de products (Collapse) + "Agregar producto"
  ProductPanel.tsx       // header del product + sus option_groups
  OptionGroupPanel.tsx   // header del group + sus options
  OptionRow.tsx          // option + activo + acciones
  ProductFormModal · OptionGroupFormModal · OptionFormModal
hooks/
  useCatalog.ts          // products.catalog (anidado, includeInactive)
  useProductMutations · useOptionGroupMutations · useOptionMutations  // create/update/toggleActive/reorder
```

### 4.7 Tipos de evento — feature estándar

`event_types` es un **lookup plano** → feature estándar `DataTable` (receta de
`docs/frontend/architecture.md §13`) en `/admin/event-types`: CRUD con **soft-delete** (activar/
desactivar, no borrar). Comparte el grupo **Catálogo** del sidebar.

### 4.8 Móvil

El acordeón ya es la respuesta mobile-first (todo colapsable). Reordenar con **↑/↓** en la card; el
resto (crear/editar/desactivar) por el menú `⋮`.

---

## 5. Configuración — `/admin/settings`

Donde el admin ajusta los **parámetros de negocio** que alimentan las cotizaciones: impuestos por
estado, depósito por defecto, validez, mínimo de personas por línea e inicio del consecutivo. **No es
lista** (DataTable) → es una **página de form**. Ítem propio del sidebar (no en el grupo Catálogo),
visible solo para admin/superadmin (recurso `config`).

> Estos valores alimentan el builder y el cálculo (§2.3, `mach-bar-domain.md §7`). **Cambiarlos afecta
> solo cotizaciones nuevas**; las históricas conservan su snapshot (`mach-bar-domain.md §D9`).

### 5.1 Datos

```ts
useConfig()        // trpc.config.get → { states: [{ state, taxRate }], app: { depositRate, quoteValidityMonths, minPersonsPerLine, quoteSeqStart } }
useUpdateConfig()  // trpc.config.update → guarda ambos buckets + invalida + useApiError
```

`useConfig` es el **mismo hook** que consume el builder (server-state cacheado); al guardar se invalida.

### 5.2 Layout — dos tarjetas en un `Form`

```
Configuración

┌─ Impuestos por estado ──────────────┐   → state_settings (una fila por estado)
│  NY   [ 8.875 ] %                    │
│  NJ   [ 6.625 ] %                    │
│  CT   [ 6.350 ] %                    │
└──────────────────────────────────────┘

┌─ Cotizaciones ──────────────────────┐   → app_settings (singleton)
│  Depósito por defecto   [ 50 ] %     │
│  Validez                [ 3 ] meses  │
│  Mínimo personas/línea  [ 30 ]       │
│  Inicio de consecutivo  [ 1043 ]     │  ← último usado: 1042
└──────────────────────────────────────┘
                          [ Guardar ]
```

Un solo "Guardar" que manda ambos buckets (`config.update`).

### 5.3 Porcentajes: decimal en DB, `%` en la UI

Las tasas se guardan como **decimal** (`tax_rate 0.08875`, `deposit_rate 0.5`) pero se muestran como
**porcentaje** (`8.875%`, `50%`). Se convierte `×100` al cargar y `/100` al guardar — mismo criterio
que los centavos con el dinero (§`mach-bar-domain.md §3`). Input con sufijo `%`.

### 5.4 Reglas

- **Snapshot** (hint en la UI): "los cambios afectan solo cotizaciones nuevas".
- **`quoteSeqStart`**: no puede ser **< último `seq` usado**. El server valida (`AppError
  SEQUENCE_BELOW_LAST` → `useApiError`); la UI muestra el último usado como hint y lo pone de `min`.
- **Sin `travelFee`** todavía (columna futura en `state_settings`, `mach-bar-domain.md §D10`).
- **`event_types` NO se gestiona acá**: vive en el grupo Catálogo (§4.7).

### 5.5 Componentes (feature `settings`)

```
features/settings/components/
  SettingsPage.tsx       // orquesta; 2 cards en un Form + Guardar
  TaxRatesCard.tsx       // fila por estado (NY/NJ/CT) con input %
  QuoteDefaultsCard.tsx  // depósito %, validez, min personas/línea, inicio de consecutivo
hooks/
  useConfig.ts           // config.get (cacheado; compartido con el builder)
  useUpdateConfig.ts     // config.update + invalidar + useApiError
```

### 5.6 Permisos y móvil

Página gateada con el recurso `config` (solo admin/superadmin): sin permiso, el ítem del sidebar se
oculta y la ruta la corta el middleware. Móvil: las cards se apilan e inputs full-width (ya mobile-first).

---

## 6. Detalle de evento — `/admin/events/[id]`

Vista **operativa** del evento confirmado: lo que la cuadrilla prepara, más el seguimiento de pagos y
staff. El evento **lee su composición de la quote** (`mach-bar-domain.md §D13`), así que la parte de
productos/opciones es **read-only**.

### 6.1 Datos

```ts
useEvent(id)  // trpc.events.getById → evento + cliente + eventType + composición (líneas+opciones de la quote) + staff asignado
```

### 6.2 Secciones

1. **Header** — número (de la quote), fecha/hora (date-fns), estado, dirección, tag de tipo, badge de
   status (derivado de `quote.stage`: upcoming/completed/cancelled). Acciones: ver quote, descargar
   PDF, marcar realizado / cancelar.
2. **Composición** (read-only) — líneas (producto · personas · precio) con opciones agrupadas por
   sección. Es lo que se prepara.
3. **Pagos** — total / depósito / saldo (`formatMoney`); toggles `depositPaid` + `balancePaid`;
   `paymentMethod` (select zelle/cash/card/check).
4. **Staff** — lista `event_staff` (nombre + rol) + **"Asignar"** (`AssignStaffModal` reusado del
   pipeline §3.5) + remover.

### 6.3 Acciones que cambian el stage

"Marcar realizado" (`confirmed→completed`) y "Cancelar" (`→cancelled`) usan la **misma matriz de
transiciones** que el pipeline (§3.2); el server revalida. Mutaciones `events.markCompleted` /
`quotes.cancel`.

### 6.4 Componentes (feature `events`)

```
features/events/components/detail/
  EventDetailPage.tsx    // orquesta
  EventHeader.tsx        // datos + acciones (realizar/cancelar/PDF/link a quote)
  EventComposition.tsx   // líneas + opciones (read-only, de la quote)
  EventPayments.tsx      // deposit/balance toggles + paymentMethod + montos
  EventStaffPanel.tsx    // lista event_staff + AssignStaffModal (reusado del pipeline)
hooks/
  useEvent.ts            // events.getById
  useEventPayments.ts    // events.updatePayment
  useEventStaff.ts       // assignStaff / removeStaff (+ staff.getAvailability)
```

### 6.5 Móvil

Secciones apiladas; la composición colapsable.

---

## 7. Ficha de cliente — `/admin/clients/[id]`

Vista 360: datos del cliente + su historial de cotizaciones y eventos.

### 7.1 Datos

```ts
useClient(id)  // trpc.clients.getById → datos + status derivado (lead/active)
// + quotes.list({ clientId }) y events.list({ clientId }) — listas filtradas por cliente
```

`quotes.list` y `events.list` aceptan un filtro **`clientId`** (extienden su list query).

### 7.2 Layout

- **`ClientInfoCard`** (header): datos + tag de status (lead/active) + **Editar** (reusa
  `EditClientModal` de la feature `clients`).
- **Tabs** (`AntD Tabs`):
  - **Cotizaciones** — `DataTable` de las quotes del cliente (número, fecha, total, stage) + botón
    **"Nueva cotización"** precargada con este cliente.
  - **Eventos** — `DataTable` de sus eventos (fecha, tipo, total, status).

### 7.3 Componentes (feature `clients`)

```
features/clients/components/detail/
  ClientDetailPage.tsx   // orquesta; header + tabs
  ClientInfoCard.tsx     // datos + status + editar (reusa EditClientModal)
  ClientQuotesTab.tsx    // DataTable de quotes del cliente (useQuotesList con clientId)
  ClientEventsTab.tsx    // DataTable de eventos del cliente
hooks/
  useClient.ts           // clients.getById
```

### 7.4 Móvil

Header apilado; los tabs funcionan en móvil (cada lista rinde card, §DataTable).

---

## 8. Dashboard — `/admin`

Métricas del mes de un vistazo (reemplaza el resumen del Excel). **Solo lecturas agregadas.**

### 8.1 Datos — endpoints de agregación

```ts
dashboard.summary({ month, year })    // { eventsCount, revenue(cents), quotesCount, closeRate }
dashboard.upcomingEvents({ limit })   // próximos eventos (confirmed, eventDate ≥ hoy)
dashboard.topProducts({ month, year })// productos más solicitados (de quotes confirmed/completed)
dashboard.quotesByMonth({ year })     // conteo por mes (para la gráfica)
```

> **Nota BE**: son queries de agregación (`GROUP BY`/`SUM`/`COUNT`); **no** siguen el patrón CRUD ni
> `Paginated`. El módulo `dashboard` es solo procedures de `query` (sin resource/repository estándar).

### 8.2 Layout

- **Selector mes/año** (default: actual).
- **Fila de 4 `MetricCard`**: eventos, ingresos (`formatMoney`), cotizaciones, tasa de cierre (%).
- **Gráfica de barras**: cotizaciones por mes del año (§8.3).
- **Próximos eventos** (lista) · **Top productos** (ranking).

### 8.3 Gráfica — lib de charts (decisión pendiente)

AntD **no** trae charts. Opciones: **Recharts** (liviana, popular, declarativa), `@ant-design/charts`
(integra con AntD pero pesada), `nivo`/`visx`. Recomiendo **Recharts**. Colores según
`docs/frontend/styling-guide.md` (tokens de marca), no hex sueltos.

### 8.4 Componentes (feature `dashboard`)

```
features/dashboard/components/
  DashboardPage.tsx       // orquesta; selector mes/año + grid
  MetricCard.tsx          // KPI tile (candidato a components/shared si se reusa)
  QuotesByMonthChart.tsx  // barras (lib §8.3)
  UpcomingEventsList.tsx  // próximos eventos
  TopProductsList.tsx     // ranking
hooks/
  useDashboard.ts         // summary / upcomingEvents / topProducts / quotesByMonth
```

### 8.5 RBAC + móvil

Recurso `dashboard` (READ) — ya existe el ítem de nav. Móvil: KPIs en 2×2 / 1 columna; la gráfica con
`overflow-x` scroll en su contenedor; listas apiladas.
