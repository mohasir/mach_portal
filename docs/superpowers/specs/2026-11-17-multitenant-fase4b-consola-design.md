# Multi-tenant fase 4b-1: consola de plataforma (`/console`) — diseño

Rama: `feat/mt-fase-4b-platform` (desde `multitenant`). Programa: `docs/superpowers/specs/2026-10-19-multitenant-fase1-design.md`. Antecedente: `docs/superpowers/specs/2026-11-13-multitenant-fase4a-features-design.md` ("No incluye").

## 1. Objetivo y alcance

Hoy el administrador de plataforma gestiona las organizaciones por CLI (`tenant:create`, `feature:set|unset|list`, `tenant:set-catalog-kind`). Esta fase le da una consola web, `/console`, para el trabajo diario: ver todas las organizaciones, cambiar sus features, su tipo de catálogo, crear organizaciones y revisar el historial.

**Incluye:**
- Módulo `console` en la API, con `platformProcedure` y conexión `platform`.
- Tabla `platform_audit_log` para la auditoría de la consola.
- Web: rutas `/console`, guard, redirección tras el login, portada, listado, creación y detalle de organización.
- Escrituras: features (con vencimiento y precio pactado), `catalog_kind` y crear organización.
- Etiquetas de vencimiento ("vence en N días", "vencida"), sin notificaciones.
- Resumen global y por organización (totales de productos, clientes, cotizaciones por estado y eventos).

**No incluye:** labs (4b-2); perfil de la organización y branding (4b-3); planes y precios de lista; facturación y cobro real; avisos por correo; reautenticación en las escrituras (decisión: no por ahora, se puede añadir sin rehacer).

**Quién entra:** solo usuarios con `user.is_platform_admin = true`. Ese valor solo se asigna fuera de la app (seed o script); ningún usuario puede ponérselo desde la web. Un miembro de una organización, incluido su dueño, no entra.

## 2. Arquitectura de la API

Se descartaron un servicio aparte (más infraestructura de la necesaria con pocos administradores de confianza) y una política RLS que deje pasar al administrador en todas las tablas (cambio de riesgo alto que afectaría a todos los clientes).

**Módulo** `apps/api/src/modules/console/`, con el patrón de `docs/backend/architecture.md` (resource → repository → service → router). Sub-routers:

| Sub-router | Procedimientos |
|---|---|
| `organizations` | listado, detalle, crear |
| `features` | listar, activar o modificar, desactivar |
| `catalog` | cambiar `catalog_kind` |
| `history` | cambios de features y accesos de plataforma |
| `summary` | totales globales y por organización |

**`platformProcedure`:** `authedProcedure` más una comprobación de `is_platform_admin` releída de la BD en cada petición (no del caché de la sesión). Si falla responde `FORBIDDEN` genérico, sin pista de que la ruta existe.

**Conexión:** las consultas del módulo usan `platformDb()` (rol `platform`, `BYPASSRLS`). Como no hay segunda barrera, cada consulta filtra por organización de forma explícita y se prueba por separado. El rol `app` de las rutas normales sigue sin poder escribir las tablas gestionadas por la plataforma.

**Escrituras:** reutilizan `setFeature`, `unsetFeature`, `setCatalogKind` y `createTenant` tal cual (ya validan dependencias y registran `tenant_feature_events`). Tras cambiar una feature, el endpoint llama a `clearFeatureCache(tenantId)` para que el efecto sea instantáneo.

**Resumen:** consultas de conteo con el rol `platform`; cada una cuenta una sola organización o devuelve un agrupado por organización. Si una falla, solo esa tarjeta muestra error.

## 3. Auditoría: `platform_audit_log`

`platform_access_log` exige una organización en cada fila y registra el acceso de un admin dentro de una organización; sigue como está. La consola necesita acciones sin organización (listar, crear), así que tiene su propia tabla.

Columnas: `id`, `user_id`, `action` (clave estable, p. ej. `organization.create`, `feature.set`), `tenant_id` (nullable), `payload` (JSON), `created_at`.

- **Escrituras:** siempre se registran. La fila se escribe en la misma transacción que el cambio, de modo que si falla el registro la escritura se revierte.
- **Lecturas de detalle de una organización:** se registran una vez por sesión y organización (mismo mecanismo en memoria que `recordPlatformAccess`).
- **Listado global y portada:** no se registran.
- **RLS:** activo y forzado, sin política. El rol `app` no lee ni escribe. Solo `platform` accede. Se añade a `PLATFORM_MANAGED_TABLES` y a las comprobaciones de `mt:verify`.

## 4. Web

**Rutas** (`apps/web/src/app/console/`, layout propio sin `TenantGate` ni selector de organización; se añade `/console` a `PROTECTED_ROUTES`):
- `/console`: portada con el resumen global.
- `/console/organizations`: listado y botón de crear.
- `/console/organizations/[id]`: detalle.

**Entrada tras el login:** un admin de plataforma aterriza en `/console`, tenga o no membresía. La decisión se toma en `/` y tras el login con `isPlatformAdmin` de la sesión (el middleware solo mira el caché de la cookie y no decide). Desde la consola, "Entrar a una organización" lleva a `/select-organization` y de ahí a `/admin`. Dentro de `/admin`, el admin de plataforma ve un enlace "Volver a la consola".

**Protección:** `ConsoleGuard` en el layout usa `useIsPlatformAdmin()`; si no lo es, muestra la 404 normal. Es solo comodidad: la barrera real es la API (§2).

**Pantallas** (móvil primero; `DataTable` más tarjetas en móvil según `docs/frontend/architecture.md`):
- **Portada:** totales globales y features que vencen pronto.
- **Listado:** búsqueda, tipo de catálogo, cantidad de features activas y etiqueta de vencimiento; cada fila abre el detalle.
- **Crear organización:** formulario; al terminar muestra el enlace de configuración inicial (`setupUrl`) para copiarlo.
- **Detalle**, con pestañas: Resumen (totales de la organización), Features (interruptor por feature con vencimiento y precio; las dependencias se explican junto al interruptor), Catálogo (productos o servicios) e Historial (cambios de features y accesos, en una sola línea de tiempo).

**Convenciones:** código en `features/console/`, hooks tRPC propios, i18n es/en, iconos `lucide-react`, fechas con `useDateFormatter`.

## 5. Errores

- Sin permiso: `FORBIDDEN` genérico; la web muestra la 404.
- Dependencias de features: los errores existentes llegan a la UI con el nombre de las features implicadas, junto al interruptor.
- Crear organización: slug duplicado y datos inválidos se devuelven como `AppError` con código propio y se muestran en el campo.
- Fallo del registro de auditoría: la escritura se revierte (features y tipo de catálogo, en la misma transacción). La excepción es crear una organización: `createTenant` provisiona la cuenta fuera de su transacción, así que la auditoría se escribe después y, si falla, la organización ya existe y la API devuelve el error.

## 6. Pruebas

- **API (integración):** cada endpoint rechaza a un usuario sin `is_platform_admin`, incluido un miembro con rol dueño; las consultas por organización no devuelven datos de otra; cada escritura deja su fila en `platform_audit_log`; `clearFeatureCache` se ejecuta tras cambiar una feature; las lecturas de detalle se registran una vez por sesión y organización.
- **RLS:** `app` no lee ni escribe `platform_audit_log`.
- **`mt:verify`:** comprobación de la tabla nueva.
- **Web:** `ConsoleGuard`, redirección tras el login, cálculo de la etiqueta de vencimiento.
- **Manual:** lo hace el usuario; al final de la fase se deja un checklist.

## 7. Orden de entrega (commits)

1. Esquema y migración de `platform_audit_log`, con su RLS y pruebas.
2. `platformProcedure` y esqueleto del módulo `console`, con la auditoría.
3. `organizations`: listado, detalle y crear.
4. `features` y `catalog`, con la invalidación de la caché.
5. `history` y `summary`.
6. Web: layout, guard, redirección tras el login y portada.
7. Web: organizaciones (listado, crear, detalle y pestañas).
8. Documentación: `docs/backend/architecture.md`, runbook y nota en `docs/frontend/architecture.md`. Sin artículos de ayuda: la consola es solo para la plataforma, no para los usuarios de una organización.

## 8. Riesgos y notas

- `BYPASSRLS` quita la segunda barrera en el módulo: un filtro olvidado puede mezclar organizaciones. Mitigación: repositories pequeños y una prueba de aislamiento por consulta.
- Un solo `is_platform_admin` da acceso total a todas las organizaciones; por eso toda escritura se audita y no se expone ninguna vía para asignar el flag desde la web.
- El nombre `/console` es una etiqueta de ruta; se cambia en un solo lugar.
- El tipo `lab` para features experimentales se añade en 4b-2 sin tocar esta fase: la consola ya muestra cualquier feature del catálogo.
- Los nombres exactos de acciones de auditoría y los campos del resumen se fijan en el plan.
