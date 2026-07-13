# Mach Bar — Especificaciones del Proyecto

> Portal administrativo para gestión de cotizaciones, eventos, clientes y staff.
> Stack: Next.js · tRPC · Express · Drizzle ORM · PostgreSQL

---

## Tabla de contenido

1. [Visión general](#1-visión-general)
2. [Modelo de datos — Drizzle + PostgreSQL](#2-modelo-de-datos)
3. [Backend — Express + tRPC](#3-backend)
4. [Frontend — Next.js + tRPC proxy](#4-frontend)
5. [Flujo de datos end-to-end](#5-flujo-de-datos)
6. [Variables de entorno](#6-variables-de-entorno)
7. [Roadmap de fases](#7-roadmap)

---

## 1. Visión general

### Descripción del negocio
Mach Bar es un servicio de estaciones para eventos (Crepaletas, Crepes, Mini Pancakes, Nachos, Fruit Station, Esquites, Snack Station, Popsicles, Craft Bar) con cobertura en NY, NJ y CT.

### Objetivos del portal — Fase 1
- Reemplazar el seguimiento manual en Excel
- Registrar clientes y leads
- Crear cotizaciones con detalle de estaciones y catálogo de ingredientes
- Exportar cotizaciones en PDF
- Asignar staff a cada evento confirmado
- Pipeline visual de leads (Nuevo → Cotizado → Confirmado → Completado → Cancelado)
- Tracking mensual de eventos e ingresos

### Stack técnico
| Capa | Tecnología |
|---|---|
| Base de datos | PostgreSQL |
| ORM | Drizzle ORM |
| API | Express.js + tRPC |
| Frontend | Next.js 14 (App Router) |
| API client | tRPC proxy (Next.js → Express) |
| Autenticación | NextAuth.js (fase 1: single user) |
| Estilos | Tailwind CSS |
| PDF export | React-PDF / Puppeteer |

---

## 2. Modelo de datos

### 2.1 Schema overview

```
clients
  └── quotes (1:N)
        └── quote_stations (1:N)
              └── quote_station_selections (1:N)
  └── events (1:N)
        └── event_stations (1:N)
        └── event_staff (1:N)

staff
  └── event_staff (1:N)

stations (catálogo maestro)
  └── station_sections (1:N)
        └── station_items (1:N)
```

---

### 2.2 Tablas Drizzle

#### `clients`
```ts
export const clients = pgTable('clients', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       varchar('name', { length: 255 }).notNull(),
  phone:      varchar('phone', { length: 30 }),
  email:      varchar('email', { length: 255 }),
  city:       varchar('city', { length: 100 }),
  state:      stateEnum('state'),             // 'NY' | 'NJ' | 'CT'
  address:    text('address'),
  notes:      text('notes'),
  status:     clientStatusEnum('status')      // 'lead' | 'active' | 'inactive'
              .default('lead').notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
  updatedAt:  timestamp('updated_at').defaultNow().notNull(),
});
```

#### `staff`
```ts
export const staff = pgTable('staff', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       varchar('name', { length: 255 }).notNull(),
  phone:      varchar('phone', { length: 30 }),
  email:      varchar('email', { length: 255 }),
  isActive:   boolean('is_active').default(true).notNull(),
  createdAt:  timestamp('created_at').defaultNow().notNull(),
});
```

#### `stations` — catálogo maestro
```ts
export const stations = pgTable('stations', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         varchar('name', { length: 100 }).notNull().unique(),
  // 'Crepaletas' | 'Crepes' | 'Mini Pancakes' | 'Nachos' |
  // 'Fruit Station' | 'Esquites' | 'Snack Station' | 'Popsicles' | 'Craft Bar'
  description:  text('description'),
  basePrice:    numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  isPremium:    boolean('is_premium').default(false).notNull(),
  isActive:     boolean('is_active').default(true).notNull(),
  sortOrder:    integer('sort_order').default(0),
});
```

#### `station_sections` — secciones del catálogo (Toppings, Frutas, Jarabes…)
```ts
export const stationSections = pgTable('station_sections', {
  id:         uuid('id').primaryKey().defaultRandom(),
  stationId:  uuid('station_id').notNull()
              .references(() => stations.id, { onDelete: 'cascade' }),
  label:      varchar('label', { length: 100 }).notNull(),
  // ej: 'Toppings (elige 7)', 'Frutas (elige 2)'
  maxSelect:  integer('max_select').default(99).notNull(),
  // 99 = sin límite
  sortOrder:  integer('sort_order').default(0),
});
```

#### `station_items` — ítems dentro de cada sección
```ts
export const stationItems = pgTable('station_items', {
  id:         uuid('id').primaryKey().defaultRandom(),
  sectionId:  uuid('section_id').notNull()
              .references(() => stationSections.id, { onDelete: 'cascade' }),
  name:       varchar('name', { length: 100 }).notNull(),
  sortOrder:  integer('sort_order').default(0),
});
```

#### `quotes`
```ts
export const quotes = pgTable('quotes', {
  id:           uuid('id').primaryKey().defaultRandom(),
  number:       serial('number').unique().notNull(),
  // auto-incremental: 2026-001, 2026-002...
  clientId:     uuid('client_id').notNull()
                .references(() => clients.id),
  eventType:    varchar('event_type', { length: 100 }),
  eventDate:    date('event_date'),
  eventTime:    time('event_time'),
  state:        stateEnum('state'),
  address:      text('address'),
  numServices:  integer('num_services').default(1).notNull(),
  subtotal:     numeric('subtotal', { precision: 10, scale: 2 }).default('0'),
  totalAmount:  numeric('total_amount', { precision: 10, scale: 2 }).default('0'),
  depositAmount:numeric('deposit_amount', { precision: 10, scale: 2 }),
  notes:        text('notes'),
  status:       quoteStatusEnum('status')
                // 'draft' | 'sent' | 'approved' | 'rejected' | 'expired'
                .default('draft').notNull(),
  validUntil:   date('valid_until'),
  // auto: fecha emisión + 3 meses
  pipelineStage: pipelineEnum('pipeline_stage')
                // 'new' | 'quoted' | 'confirmed' | 'completed' | 'cancelled'
                .default('new').notNull(),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});
```

#### `quote_stations` — estaciones dentro de una cotización
```ts
export const quoteStations = pgTable('quote_stations', {
  id:         uuid('id').primaryKey().defaultRandom(),
  quoteId:    uuid('quote_id').notNull()
              .references(() => quotes.id, { onDelete: 'cascade' }),
  stationId:  uuid('station_id').notNull()
              .references(() => stations.id),
  numPersons: integer('num_persons').notNull(),
  // mínimo 30
  pricePerPerson: numeric('price_per_person', { precision: 10, scale: 2 }).notNull(),
  subtotal:   numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  sortOrder:  integer('sort_order').default(0),
});
```

#### `quote_station_selections` — ingredientes seleccionados por estación
```ts
export const quoteStationSelections = pgTable('quote_station_selections', {
  id:              uuid('id').primaryKey().defaultRandom(),
  quoteStationId:  uuid('quote_station_id').notNull()
                   .references(() => quoteStations.id, { onDelete: 'cascade' }),
  stationItemId:   uuid('station_item_id').notNull()
                   .references(() => stationItems.id),
  sectionId:       uuid('section_id').notNull()
                   .references(() => stationSections.id),
});
```

#### `events` — eventos confirmados (derivan de quotes aprobadas)
```ts
export const events = pgTable('events', {
  id:           uuid('id').primaryKey().defaultRandom(),
  quoteId:      uuid('quote_id').references(() => quotes.id),
  clientId:     uuid('client_id').notNull()
                .references(() => clients.id),
  eventType:    varchar('event_type', { length: 100 }),
  eventDate:    date('event_date').notNull(),
  eventTime:    time('event_time'),
  state:        stateEnum('state').notNull(),
  address:      text('address').notNull(),
  totalAmount:  numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  depositPaid:  boolean('deposit_paid').default(false).notNull(),
  balancePaid:  boolean('balance_paid').default(false).notNull(),
  paymentMethod: paymentMethodEnum('payment_method'),
  // 'zelle' | 'cash' | 'card' | 'check'
  notes:        text('notes'),
  status:       eventStatusEnum('status')
                // 'upcoming' | 'completed' | 'cancelled'
                .default('upcoming').notNull(),
  month:        varchar('month', { length: 20 }),
  // desnormalizado para filtros rápidos: 'enero', 'febrero'...
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});
```

#### `event_stations`
```ts
export const eventStations = pgTable('event_stations', {
  id:             uuid('id').primaryKey().defaultRandom(),
  eventId:        uuid('event_id').notNull()
                  .references(() => events.id, { onDelete: 'cascade' }),
  stationId:      uuid('station_id').notNull()
                  .references(() => stations.id),
  numPersons:     integer('num_persons').notNull(),
  pricePerPerson: numeric('price_per_person', { precision: 10, scale: 2 }).notNull(),
  subtotal:       numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
});
```

#### `event_staff` — asignación de staff a eventos
```ts
export const eventStaff = pgTable('event_staff', {
  id:        uuid('id').primaryKey().defaultRandom(),
  eventId:   uuid('event_id').notNull()
             .references(() => events.id, { onDelete: 'cascade' }),
  staffId:   uuid('staff_id').notNull()
             .references(() => staff.id),
  role:      varchar('role', { length: 100 }),
  // ej: 'Operadora principal', 'Asistente'
  assignedAt: timestamp('assigned_at').defaultNow().notNull(),
});
```

### 2.3 Enums

```ts
export const stateEnum = pgEnum('state', ['NY', 'NJ', 'CT']);

export const clientStatusEnum = pgEnum('client_status', [
  'lead', 'active', 'inactive'
]);

export const quoteStatusEnum = pgEnum('quote_status', [
  'draft', 'sent', 'approved', 'rejected', 'expired'
]);

export const pipelineEnum = pgEnum('pipeline_stage', [
  'new', 'quoted', 'confirmed', 'completed', 'cancelled'
]);

export const eventStatusEnum = pgEnum('event_status', [
  'upcoming', 'completed', 'cancelled'
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'zelle', 'cash', 'card', 'check'
]);
```

### 2.4 Índices recomendados

```ts
// Búsqueda rápida de cotizaciones por mes/estado
index('idx_quotes_event_date').on(quotes.eventDate)
index('idx_quotes_pipeline').on(quotes.pipelineStage)
index('idx_quotes_client').on(quotes.clientId)
index('idx_events_month').on(events.month)
index('idx_events_date').on(events.eventDate)
index('idx_events_state').on(events.state)
```

---

## 3. Backend

### 3.1 Estructura de directorios

```
apps/
  api/
    src/
      index.ts                  # Express server entry
      trpc.ts                   # tRPC init, context, middleware
      db/
        index.ts                # Drizzle client
        schema/
          clients.ts
          staff.ts
          stations.ts
          quotes.ts
          events.ts
          enums.ts
        migrations/             # Drizzle migrations
      routers/
        _app.ts                 # Root router (merge all)
        clients.ts
        staff.ts
        stations.ts
        quotes.ts
        events.ts
        dashboard.ts
      services/
        pdf.service.ts          # Generación de PDF
        quote.service.ts        # Lógica de precios, validaciones
      middleware/
        auth.ts
        errorHandler.ts
```

### 3.2 tRPC context

```ts
// src/trpc.ts
import { initTRPC } from '@trpc/server';
import { db } from './db';

export const createContext = ({ req, res }: CreateExpressContextOptions) => ({
  db,
  req,
  res,
  // session: await getSession(req) — fase 2
});

const t = initTRPC.context<typeof createContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(/* auth middleware */);
```

### 3.3 Routers y procedimientos

#### `clients.router`

| Procedimiento | Tipo | Input | Descripción |
|---|---|---|---|
| `clients.list` | query | `{ state?, status?, search? }` | Listar clientes con filtros |
| `clients.getById` | query | `{ id: uuid }` | Detalle de cliente + historial |
| `clients.create` | mutation | `ClientCreateInput` | Crear cliente/lead |
| `clients.update` | mutation | `{ id, data }` | Actualizar datos |
| `clients.delete` | mutation | `{ id }` | Eliminar cliente |

#### `quotes.router`

| Procedimiento | Tipo | Input | Descripción |
|---|---|---|---|
| `quotes.list` | query | `{ month?, status?, clientId? }` | Listar con filtros |
| `quotes.getById` | query | `{ id }` | Cotización completa con estaciones e ingredientes |
| `quotes.create` | mutation | `QuoteCreateInput` | Crear cotización con estaciones |
| `quotes.update` | mutation | `{ id, data }` | Actualizar cotización |
| `quotes.updateStage` | mutation | `{ id, stage }` | Mover en pipeline |
| `quotes.approve` | mutation | `{ id }` | Aprobar → genera event automáticamente |
| `quotes.generatePdf` | mutation | `{ id }` | Retorna URL del PDF generado |
| `quotes.delete` | mutation | `{ id }` | Eliminar cotización draft |

#### `events.router`

| Procedimiento | Tipo | Input | Descripción |
|---|---|---|---|
| `events.list` | query | `{ month?, state?, status? }` | Listar eventos con filtros |
| `events.getById` | query | `{ id }` | Evento completo con staff y estaciones |
| `events.create` | mutation | `EventCreateInput` | Crear evento manual |
| `events.update` | mutation | `{ id, data }` | Actualizar datos del evento |
| `events.assignStaff` | mutation | `{ eventId, staffId, role? }` | Asignar persona al evento |
| `events.removeStaff` | mutation | `{ eventId, staffId }` | Remover asignación |
| `events.markCompleted` | mutation | `{ id }` | Marcar como completado |

#### `staff.router`

| Procedimiento | Tipo | Input | Descripción |
|---|---|---|---|
| `staff.list` | query | `{ isActive? }` | Listar staff activo |
| `staff.create` | mutation | `StaffCreateInput` | Agregar persona |
| `staff.update` | mutation | `{ id, data }` | Actualizar |
| `staff.getAvailability` | query | `{ date }` | Staff sin asignación en una fecha |

#### `stations.router`

| Procedimiento | Tipo | Input | Descripción |
|---|---|---|---|
| `stations.list` | query | — | Catálogo completo con secciones e ítems |
| `stations.getById` | query | `{ id }` | Detalle de una estación |
| `stations.updatePrice` | mutation | `{ id, basePrice }` | Actualizar precio base |

#### `dashboard.router`

| Procedimiento | Tipo | Input | Descripción |
|---|---|---|---|
| `dashboard.summary` | query | `{ month, year }` | Métricas del mes: eventos, ingresos, tasa cierre |
| `dashboard.upcomingEvents` | query | `{ limit? }` | Próximos N eventos |
| `dashboard.topStations` | query | `{ month?, year? }` | Estaciones más solicitadas |
| `dashboard.quotesByMonth` | query | `{ year }` | Cotizaciones agrupadas por mes |

### 3.4 Validaciones clave (Zod)

```ts
export const QuoteStationInput = z.object({
  stationId:      z.string().uuid(),
  numPersons:     z.number().int().min(30, 'Mínimo 30 personas'),
  pricePerPerson: z.number().positive(),
  selections:     z.array(z.object({
    sectionId:     z.string().uuid(),
    stationItemId: z.string().uuid(),
  })),
});

export const QuoteCreateInput = z.object({
  clientId:   z.string().uuid(),
  eventType:  z.string().optional(),
  eventDate:  z.string().date().optional(),
  eventTime:  z.string().optional(),
  state:      z.enum(['NY', 'NJ', 'CT']),
  address:    z.string().min(1, 'Dirección requerida'),
  notes:      z.string().optional(),
  stations:   z.array(QuoteStationInput).min(1, 'Al menos una estación'),
});
```

### 3.5 Lógica de negocio

```ts
// services/quote.service.ts

// Calcular totales al crear/actualizar
export function calculateQuoteTotals(stations: QuoteStationInput[]) {
  const subtotal = stations.reduce(
    (acc, s) => acc + s.numPersons * s.pricePerPerson, 0
  );
  const deposit = subtotal * 0.5;       // 50% depósito
  const validUntil = addMonths(new Date(), 3); // válido 3 meses
  return { subtotal, totalAmount: subtotal, deposit, validUntil };
}

// Al aprobar una cotización → crear evento automáticamente
export async function approveQuote(quoteId: string, db: DrizzleClient) {
  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, quoteId) });
  // 1. Cambiar status de quote a 'approved'
  // 2. Cambiar pipelineStage a 'confirmed'
  // 3. Crear registro en events con los datos de la quote
  // 4. Copiar quote_stations → event_stations
}
```

### 3.6 PDF Service

```ts
// services/pdf.service.ts
// Genera el PDF de la cotización con el formato de Mach Bar:
// - Header con logo + número de cotización
// - Datos del cliente y evento
// - Tabla de estaciones con ingredientes seleccionados
// - Subtotales y total
// - Service Duration
// - Terms and Conditions
// - Cierre: "Make your event unforgettable"

export async function generateQuotePdf(quoteId: string): Promise<Buffer>
```

### 3.7 Express server

```ts
// src/index.ts
import express from 'express';
import cors from 'cors';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from './routers/_app';
import { createContext } from './trpc';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.use('/trpc', createExpressMiddleware({ router: appRouter, createContext }));

// PDF download endpoint
app.get('/pdf/:quoteId', async (req, res) => {
  const buffer = await generateQuotePdf(req.params.quoteId);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="mach-quote-${req.params.quoteId}.pdf"`);
  res.send(buffer);
});

app.listen(process.env.PORT ?? 3001);
```

---

## 4. Frontend

### 4.1 Estructura de directorios

```
apps/
  web/
    src/
      app/
        (auth)/
          login/
            page.tsx
        (portal)/
          layout.tsx              # Shell con topbar + nav
          dashboard/
            page.tsx
          cotizaciones/
            page.tsx              # Lista de cotizaciones
            nueva/
              page.tsx            # Formulario nueva cotización
            [id]/
              page.tsx            # Detalle / edición
              pdf/
                page.tsx          # Vista previa PDF
          eventos/
            page.tsx
            [id]/
              page.tsx
          clientes/
            page.tsx
            [id]/
              page.tsx
          pipeline/
            page.tsx
          staff/
            page.tsx
      components/
        ui/
          Badge.tsx
          Button.tsx
          Card.tsx
          Chip.tsx
          Input.tsx
          MetricCard.tsx
          Avatar.tsx
        portal/
          TopBar.tsx
          NavTabs.tsx
          StationBuilder/
            index.tsx
            StationItem.tsx
            ChipSection.tsx
          QuotePreview/
            index.tsx
            TermsBlock.tsx
            DurationBlock.tsx
          PipelineBoard.tsx
          EventRow.tsx
          StaffAssign.tsx
          MonthSummary.tsx
      lib/
        trpc.ts                   # tRPC client + proxy setup
        utils.ts
      hooks/
        useQuoteBuilder.ts        # Estado del formulario de cotización
        useStationCatalog.ts      # Cache del catálogo de estaciones
      types/
        index.ts                  # Tipos derivados del router (inferidos por tRPC)
```

### 4.2 tRPC proxy setup

```ts
// src/lib/trpc.ts
import { createTRPCNext } from '@trpc/next';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@mach-bar/api';  // tipo importado del monorepo

export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
        }),
      ],
    };
  },
  ssr: false,
});
```

### 4.3 Páginas y responsabilidades

#### `/dashboard`
- Consume `dashboard.summary`, `dashboard.upcomingEvents`, `dashboard.topStations`, `dashboard.quotesByMonth`
- Componentes: `MetricCard` × 4, gráfica de barras por mes, lista de próximos eventos, top estaciones

#### `/cotizaciones/nueva`
- Formulario en dos columnas: datos cliente + constructor de estaciones / preview en tiempo real
- Hook `useQuoteBuilder` maneja estado local: cliente, estaciones, selecciones, totales
- Al guardar → `trpc.quotes.create.useMutation()`
- Preview actualiza en tiempo real sin llamadas al servidor
- Al generar → `trpc.quotes.generatePdf.useMutation()` + descarga

#### `/cotizaciones`
- Filtros: mes, status, estado (NY/NJ/CT)
- Tabla con columnas: fecha, cliente, tipo evento, estaciones, total, pipeline stage, acciones
- Filtro por mes equivale a las "carpetas" del Excel actual

#### `/eventos`
- Filtros: mes, estado, estación
- Resumen del mes en banner (total eventos, clientes, facturado)
- Tabla con columna staff asignado (editable inline)

#### `/pipeline`
- Board kanban: 5 columnas
- Drag to move entre etapas → `trpc.quotes.updateStage.useMutation()`
- En columna "Confirmado": botón asignar staff → modal con `trpc.staff.getAvailability`

#### `/clientes`
- Grid de tarjetas + lista
- Click en cliente → historial de cotizaciones y eventos

#### `/staff`
- Listado del equipo
- Alta/baja de personas
- Vista de agenda por persona (qué eventos tiene asignados)

### 4.4 Hook `useQuoteBuilder`

```ts
// hooks/useQuoteBuilder.ts
interface QuoteBuilderState {
  client:   Partial<ClientFields>;
  stations: StationEntry[];
  // StationEntry = { stationId, name, qty, pricePerPerson, selections: Record<sectionId, itemId[]> }
}

// Acciones
addStation(stationId: string): void
removeStation(index: number): void
toggleSelection(stationIndex: number, sectionId: string, itemId: string): void
updateQty(stationIndex: number, qty: number): void
updatePrice(stationIndex: number, price: number): void

// Derivados
totals: { subtotal, deposit, validUntil }
isValid: boolean  // todos los campos requeridos y qty >= 30
```

### 4.5 Componente `StationBuilder`

```tsx
// Renderiza la lista de estaciones añadidas
// Cada StationItem es colapsable y contiene:
//   - Input de personas (mín. 30, validación inline)
//   - Input de precio/persona (editable, precargado del catálogo)
//   - Secciones con ChipSection por cada section del catálogo
//   - ChipSection: chips clickeables con contador max/actual

// Props
interface StationBuilderProps {
  stations:   StationEntry[];
  catalog:    StationWithSections[];   // del servidor, cacheado
  onChange:   (stations: StationEntry[]) => void;
}
```

### 4.6 Componente `QuotePreview`

```tsx
// Vista en tiempo real del documento de cotización
// Se actualiza con cada cambio del formulario
// Secciones:
//   - Header: logo + número + fecha + total
//   - Datos del cliente y evento
//   - Tabla de estaciones con ingredientes seleccionados
//   - Service Duration (dinámica: muestra Craft Bar solo si aplica)
//   - Terms and Conditions
//   - Cierre "Make your event unforgettable"
```

### 4.7 Filtros de cotizaciones por mes (reemplazo de carpetas Excel)

```tsx
// El filtro de mes en /cotizaciones actúa como las carpetas del Excel
// URL state: /cotizaciones?month=junio&year=2026
// Cada mes muestra:
//   - Cantidad de cotizaciones
//   - Cuántas aprobadas / pendientes
//   - Total facturado del mes
// Implementado con useSearchParams de Next.js
```

---

## 5. Flujo de datos end-to-end

### Crear cotización

```
Usuario llena formulario (Next.js)
  → useQuoteBuilder actualiza estado local
  → QuotePreview re-renderiza en tiempo real (sin API calls)
  → Usuario hace clic "Generar cotización"
  → trpc.quotes.create.mutate(QuoteCreateInput)
  → Express handler → quote.service.calculateTotals()
  → Drizzle inserta en quotes + quote_stations + quote_station_selections
  → Retorna quote completa
  → Redirect a /cotizaciones/[id]
```

### Aprobar cotización → crear evento

```
Usuario mueve tarjeta a "Confirmado" en Pipeline
  → trpc.quotes.updateStage({ id, stage: 'confirmed' })
  → O bien: trpc.quotes.approve({ id })
  → quote.service.approveQuote()
      → UPDATE quotes SET status='approved', pipeline_stage='confirmed'
      → INSERT INTO events (desde datos de quote)
      → INSERT INTO event_stations (desde quote_stations)
  → Retorna { quote, event }
  → Frontend navega a /eventos/[id] para asignar staff
```

### Asignar staff

```
Usuario abre panel "Asignar" en evento confirmado
  → trpc.staff.getAvailability({ date: eventDate })
  → Muestra staff disponible (sin evento ese día)
  → Usuario selecciona persona
  → trpc.events.assignStaff({ eventId, staffId })
  → INSERT INTO event_staff
  → Actualiza UI optimistically
```

---

## 6. Variables de entorno

### API (`apps/api/.env`)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/mach_bar
PORT=3001
FRONTEND_URL=http://localhost:3000
PDF_STORAGE_PATH=./storage/pdfs
```

### Web (`apps/web/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here
```

---

## 7. Roadmap

### Fase 1 — Portal administrativo (actual)
- [x] Modelo de datos completo
- [ ] Setup Drizzle + PostgreSQL + migraciones
- [ ] Backend tRPC: routers de clients, quotes, events, staff, stations, dashboard
- [ ] Frontend: dashboard, cotizaciones, eventos, pipeline, clientes, staff
- [ ] Constructor de estaciones con catálogo
- [ ] Preview de cotización en tiempo real
- [ ] Export PDF
- [ ] Asignación de staff
- [ ] Filtros por mes (reemplazo de carpetas Excel)

### Fase 2 — Portal de clientes (futuro)
- [ ] Página pública de Mach Bar
- [ ] Consulta de disponibilidad por fecha
- [ ] Cotizador self-service para clientes
- [ ] Flujo de reserva + depósito online (Stripe)
- [ ] Notificaciones por WhatsApp / email

---

*Generado para Mach Bar · Snack Bar & Drinks Corp. · NY · NJ · CT*
