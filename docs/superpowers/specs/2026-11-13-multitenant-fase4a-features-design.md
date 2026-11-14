# Multi-tenant fase 4a: módulos y add-ons por organización — diseño

Rama: `feat/mt-fase-4a-features` (desde `multitenant`). Programa: `docs/superpowers/specs/2026-10-19-multitenant-fase1-design.md` (fase 4: "planes y feature flags").

## 1. Objetivo y alcance

Hoy toda organización tiene todo activado y el catálogo solo sabe vender un tipo de negocio (estaciones con precio por tier). Esta fase permite controlar, por organización, qué **módulos** y qué **add-ons** tiene contratados, y generaliza el catálogo para que cada producto tenga un precio fijo por defecto y los tiers pasen a ser un add-on.

**Incluye:**
- Catálogo de features en código (`core`, `module`, `addon`) con dependencias.
- Tablas `tenant_features` (estado, vigencia y precio pactado) y `tenant_feature_events` (historial).
- Aplicación en la API (guards de módulos, `requireFeature` para add-ons, caché) y en la web (`useFeature`, `<Feature>`, navegación, estado "módulo no disponible").
- `products.price` y el comportamiento "no cotizable".
- Scripts `feature:list`, `feature:set`, `feature:unset` sobre el rol `platform`.

**No incluye (fase 4b y posteriores):** panel `/platform`, router de plataforma y listado global de organizaciones; cobro real (el precio es informativo); planes y precios de lista; "labs" o funciones experimentales; facturación, inventario y reportes como módulos; avisos de vencimiento próximo.

**Planes:** se decidió no tenerlos por ahora. Cada organización tiene su propia lista de módulos y add-ons, y el administrador de plataforma los activa uno a uno.

## 2. Catálogo de features (código)

Vive en `packages/guards/src/features/` y lo importan API y web. Es la única fuente de qué existe.

| Clave | Tipo | Requiere |
|---|---|---|
| `auth`, `users`, `roles`, `settings`, `clients`, `catalog`, `dashboard`, `support` | `core` | — |
| `quotes` | `module` | — |
| `events` (incluye pagos, personal, reprogramaciones, historial) | `module` | `quotes` |
| `notifications` | `module` | — |
| `priceTiers` | `addon` | — |
| `configurableOptions` (grupos de opciones y opciones) | `addon` | — |

- "Estaciones" es la combinación de `priceTiers` y `configurableOptions`, no una feature propia.
- Las `core` están siempre activas, no tienen fila en la base de datos y no pueden modificarse. Una `core` no puede requerir una feature no-core (lo valida un test del catálogo).
- `events` exige `quotes` porque `events.quote_id` es `NOT NULL` y `UNIQUE`: un evento nace de una cotización aceptada.
- `resolveFeatures(filas, ahora)` es una función pura. Una feature está activa si `enabled`, no ha vencido (`expires_at` es `NULL` o posterior a `ahora`) y todas las que requiere están activas.
- Los recursos de permisos se asocian a un módulo (`quote`→`quotes`; evento, pago y personal→`events`; notificaciones→`notifications`) para que el guard lo aplique de forma automática. El mapeo exacto se fija contra `RESOURCES` en el plan.

## 3. Modelo de datos

**`tenant_features`** (PK `tenant_id` + `feature_key`):
- `enabled`, `activated_at`, `expires_at` (nullable; `NULL` = permanente), `updated_at`.
- `price_cents`, `billing_period`, `currency` (nullable): precio pactado con esa organización, informativo y sin lógica de cobro. `billing_period` toma valores como mensual y anual (el conjunto exacto se fija en el plan).

**`tenant_feature_events`:** `tenant_id`, `feature_key`, acción (activó, desactivó, modificó), estado anterior y posterior (JSON), actor y fecha.

**RLS:**
- `tenant_features`: política de solo `SELECT` por `tenant_id`. No hay política de escritura, así que el rol `app` no puede modificarla (ni siquiera con un fallo en la API); escribe el rol `platform` (`BYPASSRLS`). Requiere un helper de política de solo lectura junto a `tenantIsolationPolicy`.
- `tenant_feature_events`: RLS activo y forzado, sin política. El rol `app` no ve ni escribe nada. Solo `platform` accede.

**`products.price`:** entero nullable en centavos, **por unidad**: el subtotal de una línea sin tiers es `price × cantidad` (`numPersons`). Un producto es **cotizable** si tiene `price`, o si `priceTiers` está activo y el producto tiene al menos un tier. En caso contrario es **no cotizable**.

**Permisos del rol `app`:** `db:roles` concede `SELECT/INSERT/UPDATE/DELETE` sobre todas las tablas del esquema (y por defecto sobre las futuras), así que la barrera de escritura de estas dos tablas es la RLS, no los permisos. Ambas tablas se excluyen de `TENANT_TABLES` (que asume una política `FOR ALL`) y tienen sus propias comprobaciones en `mt:verify` y en las pruebas de RLS.

**Migración `0006`** (flujo: cambio en el esquema TS → `db:generate` → revisar el SQL → `db:migrate`):
1. Crea las dos tablas con sus políticas y los permisos del rol `app` (solo lectura en la primera, ninguno en la segunda).
2. Añade `products.price`.
3. Rellena las organizaciones existentes con 5 filas permanentes (las tres de módulos y las dos de add-ons), sin precio.

Las organizaciones nuevas nacen **solo con el núcleo** (sin filas). El seed de demo activa todo.

## 4. API

**Contexto.** `ctx.features` se resuelve en la cadena tRPC, junto a `ctx.db`. Se lee con el rol `app` en una transacción corta de la organización.

**Caché.** En memoria, por organización, TTL de 30 segundos. Si la lectura falla, **falla cerrado**: solo el núcleo queda activo. Como los scripts son otro proceso, no invalidan la caché de la API; un cambio tarda como máximo el TTL en aplicarse. En la fase 4b el endpoint de plataforma invalidará al instante.

**Bloqueo:**
- **Módulos, automático.** `guardedProcedure` valida el permiso del rol y además que el módulo del recurso esté activo.
- **Add-ons, explícito.** `requireFeature('priceTiers' | 'configurableOptions')` en los endpoints de tiers, grupos y opciones.
- **Solo mutaciones.** Las consultas de datos existentes no se bloquean ("ocultar y conservar"). La web impide el acceso a la pantalla de un módulo apagado (§5).
- Error: `FEATURE_NOT_ENABLED` (en `ErrorCodes`, vía `AppError`, HTTP 403).

**Dominio de cotización:**
- Validación de línea para quien no tiene `MANAGE_LINE_PRICING`: el subtotal debe coincidir con un tier (solo si `priceTiers` está activo) o ser `products.price × numPersons` (si el producto tiene precio). Un producto no cotizable en una línea nueva responde `PRODUCT_NOT_QUOTABLE`.
- Quien tiene `MANAGE_LINE_PRICING` sigue pudiendo fijar el subtotal a mano, pero un producto no cotizable también se rechaza.
- Las cotizaciones ya creadas conservan su precio congelado, también al aceptarlas: solo se revalidan las líneas que se crean o editan.
- Con `configurableOptions` apagado, `allowSelectOptionsAtQuote` y `optionsSelectionDeadlineDays` se ignoran en la lógica pero conservan su valor.

**`features.mine`:** query para cualquier usuario autenticado de la organización; devuelve las claves activas y su vencimiento.

## 5. Web

- `features.mine` con `staleTime` de 30 s y refetch al volver a la pestaña. Las features no viajan en la sesión.
- `useFeature(key)` (booleano; las `core` siempre `true`; mientras carga, `false` para las no-core) y `<Feature name fallback>`, como `useCan` y `<Can>`.
- Los ítems de `apps/web/src/lib/navigation/constants/items.ts` pueden declarar `feature` además del permiso. Con la feature inactiva, no aparecen.
- **Módulo apagado:** la entrada por URL directa muestra el estado "módulo no disponible, contacta a tu administrador". No se muestran sus datos, aunque se conservan y vuelven al reactivar. Se diseña primero para móvil.
- **Catálogo:** el campo de precio fijo siempre está; la pestaña de tiers solo con `priceTiers`; grupos y opciones solo con `configurableOptions`. Un producto sin precio fijo y sin tiers activo muestra la etiqueta "No cotizable" y un aviso.
- **Cotizador:** el selector de tier solo con `priceTiers`; los productos no cotizables salen deshabilitados con la razón visible.
- **Configuración:** los ajustes de opciones se ocultan sin `configurableOptions`.
- i18n (es/en) para nombres y descripciones de features y para los errores nuevos.

## 6. Scripts

Tres comandos en `apps/api/src/db/scripts/`, sobre `DATABASE_PLATFORM_URL`:

```bash
pnpm --filter api feature:list  --tenant <slug>
pnpm --filter api feature:set   --tenant <slug> --key <clave> [--expires YYYY-MM-DD] [--price <centavos>] [--period <periodo>] [--currency <ISO>]
pnpm --filter api feature:unset --tenant <slug> --key <clave>
```

`--expires` es el **último día activo**: se guarda el inicio del día siguiente en UTC. Delegan en un servicio compartido que, en una sola transacción: valida la clave contra el catálogo, rechaza las `core`, valida las dependencias (activar `events` sin `quotes` activo falla, y desactivar `quotes` mientras `events` está activo también falla, nombrando a las dependientes), escribe `tenant_features` y registra el cambio en `tenant_feature_events`. Desactivar deja la fila con `enabled = false` para conservar precio y fechas. El actor del historial es el usuario del sistema operativo.

## 7. Verificación y pruebas

`mt:verify` añade dos comprobaciones: ninguna fila con clave `core` o desconocida, y ninguna organización con `events` activo sin `quotes`.

Pruebas:
- **Catálogo (unitarias):** dependencias, vencimiento, núcleo siempre activo, una `core` no requiere una no-core.
- **RLS (integración):** `app` lee solo sus filas, no puede escribir en `tenant_features` y no ve `tenant_feature_events`.
- **API:** la mutación de un módulo apagado se bloquea y su lectura no; `requireFeature` bloquea los add-ons; falla cerrado; cotizar sin tiers usa el precio fijo y devuelve `PRODUCT_NOT_QUOTABLE` sin precio; las cotizaciones existentes no cambian.
- **Servicio y script:** claves y dependencias inválidas, historial, vigencia y precio.
- **Web:** `useFeature`, `<Feature>`, filtrado de navegación y estado "módulo no disponible".

## 8. Orden de entrega (commits)

1. Catálogo en `@repo/guards` y sus pruebas.
2. Esquema, migración `0006`, RLS y `products.price`.
3. Servicio y scripts.
4. Contexto y guards de la API, con la caché.
5. Dominio de cotización y producto no cotizable.
6. Web: query, hooks, navegación y estado "módulo no disponible".
7. Web: catálogo, cotizador y configuración.
8. Documentación (`docs/backend/architecture.md`, runbook).

## 9. Riesgos y notas

- La caché de 30 s hace que un cambio hecho por script no sea instantáneo; es aceptable hasta la fase 4b.
- El relleno de la migración activa todo para las organizaciones existentes, para no quitar funcionalidad. Una organización creada después de esta fase nace sin módulos: quien la crea debe activar `quotes` y el resto con `feature:set`.
- Con RLS de solo lectura en `tenant_features`, el seed y `tenant:create` escriben con el rol `platform`.
- Los nombres de claves, periodos de cobro y el mapeo de recursos a módulos son provisionales hasta el plan.
