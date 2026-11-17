# Traspaso — arranque de la fase 4b multi-tenant (panel `/platform`)

Estado al 2026-11-17. Rama base: `multitenant` (último merge `592fe49`). La fase 4b sale de ahí en una rama propia, no apilada.

## Contexto del proyecto

- `main` es el portal del cliente real y no se toca. `multitenant` es un proyecto aparte; el cliente real no se migra por ahora (ver `docs/superpowers/runbooks/multitenant-cutover.md`). Aun así se diseña para producción, no como demo.
- Flujo de trabajo por fase: brainstorming → spec (`docs/superpowers/specs/YYYY-MM-DD-<tema>-design.md`) → plan (`docs/superpowers/plans/YYYY-MM-DD-<tema>.md`) → desarrollo con subagentes. Reglas de `CLAUDE.md`: preguntar antes de commit, push o merge; el merge a `multitenant` es `--no-ff`; sin PRs; sin worktrees; no levantar servidores.

## Qué está hecho

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Núcleo de tenancy (`tenantProcedure`, `tenantEq`, `createTenant`) | Hecha |
| 1b | RLS forzado, roles de BD `app` y `platform` | Hecha |
| 2 | Roles y permisos por organización | Hecha |
| 4a | Módulos y add-ons por organización, activados por CLI | Hecha (merge `d9f3197`) |
| Catálogo genérico 1–3 | Catálogo, impuesto por línea y cargos, ubicación de operación | Hechas (merges hasta `592fe49`) |
| **4b** | **Panel `/platform`** | **Pendiente (este traspaso)** |
| 3 (branding) | `tenant_branding`: logo, colores | Pendiente, va al final |

## Qué existe hoy para el admin de plataforma

- **Usuario admin de plataforma:** columna `user.is_platform_admin`. En datos de demo: `platform@demo.test` (sin membresía). `protectedProcedure` admite a miembros o a un admin de plataforma; este último queda auditado en `platform_access_log` (`apps/api/src/core/trpc/platformAccess.ts`).
- **Rol de BD `platform`** (`BYPASSRLS`), con conexión propia vía `DATABASE_PLATFORM_URL` (`apps/api/src/db/platform.ts`: `platformDb`, `closePlatformDb`). La API normal usa el rol `app`, que no puede escribir las tablas gestionadas por la plataforma.
- **Tablas gestionadas por la plataforma** (`PLATFORM_MANAGED_TABLES`, `apps/api/src/db/rls/policy.ts`):
  - `tenant_features`: `app` solo lee su propia organización.
  - `tenant_feature_events`: auditoría de cambios de features; invisible para `app`.
  - `tenant_profile`: hoy una columna, `catalog_kind` (productos o servicios); `app` solo lee su fila.
- **Lógica reutilizable** en `apps/api/src/lib`:
  - `features/admin.ts`: `setFeature`, `unsetFeature`, `listFeatures` (validan dependencias, por ejemplo `quotes` antes de `events`, y escriben el evento de auditoría).
  - `tenancy/profile.ts`: `getCatalogKind`, `setCatalogKind`.
  - `tenancy/createTenant.ts`: `createTenant` (devuelve `setupUrl`).
  - `features/cache.ts`: caché en memoria por organización con TTL de 30 s y `clearFeatureCache(tenantId?)`. Los scripts son otro proceso y no pueden invalidarla; el endpoint de plataforma sí debe llamarla al instante.
- **CLI actual** (`apps/api/package.json`): `tenant:create`, `tenant:set-catalog-kind`, `feature:list|set|unset`, `mt:verify`. Son lo que el panel reemplaza para el uso diario.
- **Catálogo de features:** `packages/guards/src/features/registry.ts` (núcleo, módulos `quotes`, `events`, `notifications`; add-ons `priceTiers`, `configurableOptions`, `productGallery`, `unitsOfMeasure`, `extraCharges`). Cada feature puede llevar vencimiento, precio informativo, periodo y moneda; el cobro es manual.
- **Web:** no existe ninguna ruta `/platform`; `apps/web/src/app` solo tiene `(auth)`, `admin` y `account-locked`. El superadmin con varias membresías o el admin de plataforma elige organización al entrar (`/select-organization`).

## Qué cubre la fase 4b

Según el spec de la 4a (`2026-11-13-multitenant-fase4a-features-design.md`, "No incluye"):

- Panel `/platform`, router de plataforma y listado global de organizaciones.
- Cambiar features desde la pantalla, con invalidación inmediata de la caché.

Quedó fuera de la 4a y hay que decidir si entra en 4b o se pospone: planes y precios de lista, "labs", facturación, avisos de vencimiento próximo y cobro real.

## Decisiones abiertas para el brainstorming

1. **Cómo lee la API entre organizaciones.** Propuesta anterior: un router separado, pool propio con el rol `platform`, guard `isPlatformAdmin`, auditoría de cada acción y solo lectura al principio. Hay que fijar si las escrituras (features, `catalog_kind`, crear organización) entran en la primera entrega.
2. **Alcance del panel:** listado y detalle de organizaciones; activar y desactivar features con vencimiento y precio; cambiar `catalog_kind`; crear organización (hoy `tenant:create`); ver el historial de `tenant_feature_events` y `platform_access_log`.
3. **Planes:** ¿entran paquetes de features con precio de lista, o se mantienen las features sueltas con precio acordado por organización?
4. **Seguridad:** el panel no debe ser alcanzable por usuarios sin `is_platform_admin`; revisar el guard de Origin, el tope de batch y los errores genéricos que ya existen; definir si las acciones de plataforma exigen reautenticación.
5. **Navegación:** dónde vive `/platform` (ruta propia fuera de `admin`, sin selector de organización) y cómo entra un admin de plataforma sin membresía.
6. **Perfil de la organización.** La tabla `tenant_profile` ya existe, pero la escribe solo la plataforma (`catalog_kind`). El "perfil de la organización" que el usuario quiere (nombre, logo, contacto, datos fiscales) la edita la propia organización, así que no debe mezclarse en esa tabla sin decidir antes quién escribe cada columna. Se diseña aparte, después de 4b o junto con branding; es una sección nueva en Ajustes, grupo "Sistema".

## Pendientes fuera de la 4b

- **Pruebas en navegador** de todo lo nuevo: galería, unidades por línea, impuesto por línea y cargos, ubicación de operación (EE. UU. y Nicaragua, cobertura parcial, móvil). Los checklists están en `.superpowers/sdd/*/task-*-report.md` (carpeta ignorada por git; si falta, ver los specs).
- **Service worker:** en un build de producción, el `sw.js` no debe tener entradas `geo-*-localities-*` (se excluyeron en `apps/web/next.config.ts`; con Turbopack ese método no vale).
- **Datos de Nicaragua** (`packages/geo/src/data/ni`): revisar nombres como "Corn Island" y "Laguna de Perlas" en español y los códigos `RACCN` y `RACCS`, que no son ISO.
- **Squash de migraciones** antes del primer deploy a producción (0000–0016). Preferencia: conservar la 0000 y fusionar de la 0001 en adelante en una sola, si el cliente real puede migrar.
- **Cutover del cliente real** (en `main`): sigue sin migrarse. La migración 0016 descarta `state` y `city` de clientes y las ciudades de cotizaciones sin estado; el runbook (sección 11) trae la consulta de respaldo.
- **Ramas integradas** que se pueden borrar: `feat/catalogo-generico`, `feat/impuesto-por-linea`, `feat/ubicacion-operacion`, `feat/mt-fase-4a-features`.
- **Menores aparcados** de las fases de catálogo: en `.superpowers/sdd/<plan>/progress.md` (ver sección "parked").

## Cómo empezar la próxima sesión

1. Leer este traspaso, `docs/superpowers/specs/2026-11-13-multitenant-fase4a-features-design.md` y `docs/backend/architecture.md` (§11 multi-tenant).
2. Crear `feat/mt-fase-4b-platform` desde `multitenant` actualizada (`git pull`).
3. Invocar brainstorming con la fase 4b; resolver primero las decisiones abiertas 1 y 2.
