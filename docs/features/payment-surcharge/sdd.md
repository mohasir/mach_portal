# SDD — Recargo por método de pago (tarjeta/cheque 9% + nota de pago final 10%)

> Documento de diseño técnico. Estado: **propuesto, no implementado**. Referencia de contexto de
> negocio: `apps/api/src/db/seeds/quotePdfTemplate.ts` (términos y condiciones del PDF de cotización,
> líneas 21 y 25).

---

## 1. Contexto / Problema

Los términos y condiciones que ya se envían en el PDF de cada cotización mencionan dos cargos que hoy
**no existen** en el sistema — ni en el modelo de datos ni en el cálculo de totales:

1. *"The price quoted is for Zelle and cash payments. For credit card and check payments, an
   additional 9% will be added."* — recargo sobre el **total de la cotización**.
2. *"The last payment are accepted in cash. Otherwise, an additional 10% fee will be applied to the
   remaining balance."* — recargo sobre el **saldo restante del evento**, específico del último pago.

Son dos cargos de negocio distintos entre sí, y ambos distintos del `taxRate` que ya existe en el
sistema (impuesto de venta real por estado — NY/NJ/CT —, siempre aplicado, congelado por cotización
una vez que pasa a "Enviada"). Confirmado con el usuario: **no** hay que fusionar esto con `taxRate`.

## 2. Alcance

### Dentro de alcance

- **Recargo 9% (cotización):** un switch simple por cotización — "¿aplica recargo tarjeta/cheque?" —
  no un selector de método de pago. Se calcula sobre el total (después de impuesto) y **sí** entra en
  la base del depósito. La tasa (9%) es un setting global editable en Ajustes, no un valor fijo en
  código.
- **Nota 10% (pago del evento):** aviso informativo en la pantalla de pagos del evento cuando el pago
  que se está registrando cierra el saldo restante (`amount >= balance`) y el método elegido no es
  efectivo. **Sin cálculo real todavía** — la base exacta sobre la que aplicaría el 10% queda
  pendiente de definir con el usuario.

### Fuera de alcance (por ahora)

- Selector completo de método de pago a nivel cotización (se decidió MVP = switch).
- Cálculo/cobro automático del 10% sobre el pago final del evento.
- Cualquier cambio al `taxRate` por estado existente.

## 3. Diseño — Parte A: recargo 9% en la cotización

Replica exactamente el patrón ya existente para `taxRate`/`depositRate`: una tasa global configurable
en `appSettings`, snapshoteada en la fila de la cotización al crearla, y **congelada** una vez que la
cotización pasa a estado `QUOTED` (mismo criterio que hoy aplican `taxRate`/`depositRate` en
`quotes.service.ts::resolveTotals`).

### 3.1 Modelo de datos

**`apps/api/src/db/schema/config.ts`** — nueva columna en el singleton `appSettings`:

| Columna | Tipo Drizzle | Default |
|---|---|---|
| `card_surcharge_rate` | `numeric(precision:4, scale:3)` | `0.09` |

**`apps/api/src/db/schema/quotes.ts`** — nuevas columnas en `quotes` (entre `total` y `depositRate`,
para que el orden refleje la cascada de cálculo):

| Columna | Tipo Drizzle | Default |
|---|---|---|
| `apply_card_surcharge` | `boolean` | `false` |
| `card_surcharge_rate` | `numeric(precision:4, scale:3)` | `0.09` (snapshot congelado) |
| `card_surcharge_amount` | `integer` | `0` |

Todas `NOT NULL` con default — las cotizaciones existentes quedan con el switch apagado y sin efecto
en sus totales. **No requiere backfill.** Se aplica con `pnpm --filter api db:push` (el repo no versiona
migraciones SQL; el flujo real es push directo del schema).

### 3.2 Cascada de cálculo — `packages/schemas/src/quotes.ts::computeQuoteTotals`

Orden actual: `subtotal → discountAmount → longDistanceAmount → base → taxAmount → total →
depositAmount`.

Orden propuesto (el recargo se inserta **después de impuesto, antes de depósito**, para que el
depósito quede calculado sobre el total ya con recargo):

```ts
const base = subtotal - discountAmount + longDistanceAmount;
const taxAmount = Math.round(base * input.taxRate);
const taxedTotal = base + taxAmount;                    // antes se llamaba `total`
const applyCardSurcharge = input.applyCardSurcharge ?? false;
const cardSurchargeAmount = applyCardSurcharge
  ? Math.round(taxedTotal * input.cardSurchargeRate)
  : 0;
const total = taxedTotal + cardSurchargeAmount;          // total final, incluye recargo
const depositAmount = Math.round(total * input.depositRate);
```

`total` conserva su significado de "total final" — decisión deliberada para no romper a los
consumidores existentes (columna `quotes.total`, PDF, UI) que ya asumen que `total` es el número
final. El recargo se expone además como campo propio (`cardSurchargeAmount`) para mostrarlo como
línea de desglose, igual que ya pasa con `discountAmount`/`taxAmount`.

`QuoteTotalsInput`/`QuoteTotals` (mismo archivo) ganan `applyCardSurcharge`, `cardSurchargeRate`,
`cardSurchargeAmount`. `quoteMutationFields` (usado por `createQuoteSchema`/`updateQuoteSchema`) gana
`applyCardSurcharge: z.boolean().optional()` — **sin** `cardSurchargeRate`, porque la tasa es global,
no editable por cotización (mismo criterio que `taxRate`, que tampoco es parte de este objeto).

### 3.3 Congelado de tasa — `apps/api/src/modules/quotes/quotes.service.ts`

- **`create()`**: la tasa se resuelve desde `appRow.cardSurchargeRate` (config vigente) y se pasa a
  `computeQuoteTotals` junto con `input.applyCardSurcharge`.
- **`resolveTotals()`** (usado por `update()`):
  - Si la cotización ya está en `QUOTED` → se reusan `current.applyCardSurcharge` y
    `current.cardSurchargeRate` (se ignora el input, igual que hoy con `taxRate`/`depositRate`).
  - Si está en `PENDING` → se re-derivan de la config viva (`appRow.cardSurchargeRate`) + el input del
    usuario para el switch.

Los 3 campos nuevos viajan automáticamente en el `...totals` que ya se spread al insertar/actualizar
— no hace falta lógica extra ahí.

### 3.4 Exposición vía API

`quotes.resource.ts` (`publicQuoteColumns` + `quoteResource`) y `config.resource.ts`
(`publicAppSettingsColumns` + `appSettingsResource`) son allowlists manuales — **hay que agregar los
3 campos nuevos explícitamente en cada uno**, o quedan invisibles en toda respuesta de la API (list,
detail, board).

### 3.5 Builder (web)

- `quotes.store.ts` — `QuoteBuilderState` + `emptyBuilderState()` ganan `applyCardSurcharge: boolean`
  (default `false`).
- `helpers.ts` — `toCreateInput()`/`toBuilderState()` mapean el campo nuevo ida y vuelta.
- `ExtraChargesSection.tsx` — nuevo `Switch` de AntD junto al campo de larga distancia, con el
  porcentaje vigente (`config.appSettings.cardSurchargeRate`) mostrado como hint.
- `QuoteBuilderContent.tsx` — la tasa vigente se lee de `useConfig()` (ya se consume ahí) para poder
  previsualizar el total con recargo antes de guardar.

### 3.6 Desglose (UI) y PDF

Nueva fila condicional "Recargo tarjeta/cheque (9%)" entre el renglón de impuesto y el de total, en
**los 3 lugares que hoy renderizan el desglose**:

- `QuoteSummary.tsx` (componente compartido) — recibe los 3 campos como props nuevos.
- `QuoteBuilderContent.tsx` (vista mobile) y `builder/QuotePreview/index.tsx` (preview desktop) —
  ambos pasan `totals.*` a `QuoteSummary`.
- `detail/QuoteDetailCard.tsx` (vista de solo lectura) — pasa `detail.*` en vez de `totals.*`.

`quotes.pdf.ts::buildFees()` agrega una tercera línea condicional (mismo patrón que `Long Distance
Travel Fee` y `Tax (${rate}%)`).

> Nota lateral: existe un componente `PricingPanel.tsx` con el mismo desglose duplicado que
> **no tiene ningún call site activo en la app** (verificado). Se actualizaría por consistencia, pero
> se deja marcado para que el equipo decida si conviene eliminarlo — no bloquea esta feature.

### 3.7 Ajustes (Settings)

Nuevo campo de tasa en la tarjeta de "Valores por defecto de cotización" (`QuoteDefaultsCard.tsx`),
clonando exactamente el campo de `depositRate` (InputNumber 0-100 con sufijo `%`, conversión
porcentaje↔fracción vía `toPercent`/`fromPercent`). Reutiliza el mismo mutation/permiso
(`RESOURCES.QUOTE_DEFAULTS`) que ya protege `depositRate` — no se necesita un recurso RBAC nuevo.

### 3.8 Seeds

- `db/seeds/config.ts` — el insert del singleton `appSettings` suma `cardSurchargeRate: 0.09`.
- `db/seeds/quotes.ts` — el select acotado de `appSettings` debe incluir la columna nueva, y el
  único call site de `computeQuoteTotals` en ese seeder debe recibir `cardSurchargeRate`
  (`applyCardSurcharge` se omite: el default `false` de la función alcanza).

## 4. Diseño — Parte B: nota de recargo 10% en pago del evento

Cambio **solo de UI**, sin tocar esquema/DB/schemas — el cálculo real queda pendiente de definir.

En `EventPayments.tsx`, dentro del formulario de "Registrar pago": se observan reactivamente los
campos `method` y `amount` del form (`Form.useWatch`, patrón ya usado en el codebase). Si el método
elegido no es `cash` **y** el monto ingresado cierra el saldo restante (`amount >= balance`), se
muestra un `Alert` de advertencia informando que puede corresponder un recargo del 10% sobre el saldo
final. No se envía nada nuevo a la API — es una guía visual para quien registra el pago, no una
validación ni un cargo real.

## 5. Decisiones de diseño (resumen)

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Recargo 9% = campo nuevo, separado de `taxRate` | Fusionar con el impuesto por estado existente | Son conceptos de negocio distintos (impuesto real vs. cargo por método de pago); fusionarlos rompería la trazabilidad si alguno cambia por separado |
| Switch booleano por cotización | Selector de método de pago (zelle/cash/card/check) | Decisión explícita del usuario para MVP — más simple, cubre el caso real (aplica o no aplica el 9%) |
| Recargo se calcula sobre el total (post-impuesto) y entra en la base del depósito | Calcularlo sobre el subtotal, o no incluirlo en el depósito | Pedido explícito del usuario: "el 9% del total" |
| Tasa 9% congelada por cotización una vez `QUOTED` | Siempre leer la tasa vigente de config | Simetría con `taxRate`/`depositRate`, que ya se congelan así — evita que cambiar la tasa global altere cotizaciones ya enviadas |
| 10% del pago final = nota, no cálculo | Implementar el cálculo ahora | El usuario no tiene definida la base exacta todavía — se deja pendiente explícitamente |

## 6. Preguntas abiertas / pendientes

- **Base de cálculo del 10%** sobre el saldo restante — a definir con el usuario antes de pasar de
  "nota" a "cálculo real".
- **`PricingPanel.tsx`** parece código huérfano (sin call sites) — confirmar con el equipo si se
  elimina o se mantiene.
- Si el switch de 9% debería poder **seguir editándose** después de `QUOTED` (hoy se propone que
  quede congelado, igual que `depositRate`) — confirmar que es el comportamiento esperado.

## 7. Plan de verificación

1. `pnpm --filter api db:push` sin errores tras el cambio de schema.
2. `pnpm --filter api db:fresh` (reset + push + seed) para repoblar con los nuevos defaults.
3. `pnpm check-types` (monorepo) limpio.
4. Manual en `pnpm dev`:
   - Crear cotización nueva, activar el switch, verificar el desglose (mobile y desktop) y que el
     depósito refleje el total con recargo.
   - Guardar como borrador, reabrir, confirmar que el switch y el monto persisten.
   - Pasar la cotización a "Enviada", cambiar la tasa global en Ajustes, y confirmar que la
     cotización ya enviada no cambia su recargo (tasa congelada).
   - Generar el PDF y confirmar la línea de recargo en el desglose.
   - En un evento con saldo pendiente, registrar un pago con método "Tarjeta" por el monto total del
     saldo → debe aparecer la nota; con "Efectivo" no debe aparecer.

## 8. Archivos afectados (referencia)

- `apps/api/src/db/schema/{quotes,config}.ts`
- `packages/schemas/src/{quotes,config}.ts`
- `apps/api/src/modules/quotes/{quotes.service,quotes.resource,quotes.pdf}.ts`
- `apps/api/src/modules/config/config.resource.ts`
- `apps/web/src/features/quotes/quotes.store.ts`, `helpers.ts`
- `apps/web/src/features/quotes/components/builder/{ExtraChargesSection,QuoteBuilderContent}.tsx`
- `apps/web/src/features/quotes/components/QuoteSummary.tsx` (+ sus call sites)
- `apps/web/src/features/settings/{helpers.ts,components/QuoteDefaultsCard.tsx}`
- `apps/web/src/features/events/components/detail/EventPayments.tsx`
- `apps/api/src/db/seeds/{quotes,config}.ts`
- i18n: `apps/web/src/locales/{en,es}/{quotes,settings,events}.json`
