# Ubicación de operación: plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Objetivo:** que cada organización configure su ubicación de operación (país, hasta dos niveles, cobertura, precisión y dirección) y que cotización y evento guarden el lugar según esa configuración, reemplazando el `state` fijo `NY/NJ/CT`.

**Arquitectura:** paquete compartido `@repo/geo` (un JSON por país y helpers puros); migración 0016 (tablas `tenant_location` y `tenant_location_areas`, columnas `country/region/locality` en cotización y evento, limpieza del cliente y del enum); módulo `locationSettings` y validación en cotización y evento; la web agrega la tarjeta de Ajustes y el componente `LocationFields`.

**Stack:** Drizzle + Postgres, zod, Vitest, tRPC, Next 15 + AntD v6 + Tailwind v4, i18next.

**Spec:** `docs/superpowers/specs/2026-11-16-ubicacion-operacion-design.md` (autoridad). Leer también `CLAUDE.md`, `docs/backend/architecture.md` (§8 migraciones, §11 multi-tenant), `docs/frontend/architecture.md` y `docs/frontend/styling-guide.md`.

## Restricciones globales

- Rama `feat/ubicacion-operacion`. Sin commit, push ni merge sin OK explícito del usuario: cada tarea deja sus archivos en staged con rutas explícitas (nunca `git add -A`) y se detiene. No usar `git stash`. Sin atribución de Claude en commits.
- Comentarios en inglés, solo para un *porqué* no obvio; nada que dependa de la conversación.
- Backend: `resource → repository → service → router`, repositories `(db, tenantId)` con `tenantEq`, todo id o valor de `input` resuelto con lecturas del tenant, pruebas de aislamiento; errores con `AppError`/`ErrorCodes`; permisos con `guardedProcedure` y `@repo/guards`.
- Esquema: cambiar el TS, `db:generate`, revisar y editar el SQL a mano (conversión antes de eliminar columnas y del enum), `when` estrictamente mayor que el de la 0015 y no futuro (`migrationJournal.test.ts`); luego `db:generate` no propone nada.
- El `country` de cotización y evento lo fija **el servidor** desde `tenant_location`; ningún input del cliente puede fijarlo.
- Web: mobile-first, AntD v6 + Tailwind v4, `lucide-react`, sin inline styles, sin hex, sin `uppercase`; i18n es/en con claves paralelas y test de paridad.
- **Prohibido** correr `db:migrate`, `db:fresh`, `db:reset`, `db:seed`, `feature:*`, `tenant:*` contra una base real, levantar servidores o abrir el navegador. Las pruebas de integración usan una base descartable propia (`mach_test_*`, se borra al terminar). Nunca leer `.env`.
- Verificación: tras la tarea 2 la web puede quedar en rojo por los tipos compartidos (se resuelve en la tarea 3); las tareas 1 y 2 verifican `@repo/geo`, `@repo/schemas` vía api y `api` (`check-types`, `test`, `test:int` de lo tocado). La tarea 3 corre todo (`pnpm check-types`, `pnpm test`, `test:int` completo).

## Foco de revisión

1. **Ubicación hostil:** una región o localidad fuera de la cobertura, una localidad que no pertenece a la región enviada, un país enviado por el cliente y un valor inexistente se rechazan o ignoran sin escribir nada; el país guardado siempre es el de la configuración.
2. **Activación incompleta:** activar con país, precisión o cobertura incompletos se rechaza y deja la función apagada (también a nivel de base de datos con el `CHECK`); `scope = 'areas'` sin zonas se rechaza.
3. **Apagada conserva:** con la función apagada la cotización no exige ni acepta cambios de ubicación, y lo ya guardado sigue leyéndose y se conserva al editar otros campos.
4. **Migración:** cada `state`/`city` de cotización y evento se convierte exactamente a `country='US'`, `region` y `locality`; las organizaciones con datos quedan activadas (EE. UU., nivel 2, todo el país, dirección requerida) y las demás no; clientes sin `state`/`city`; el enum desaparece.
5. **Aislamiento:** `tenant_location` y `tenant_location_areas` por organización con RLS; la cobertura de una organización no afecta a otra.
6. **Datasets íntegros:** los 50 estados y DC de EE. UU.; los 15 departamentos y 2 regiones autónomas de Nicaragua con sus municipios; sin duplicados ni nombres vacíos.

---

### Task 1: Paquete `@repo/geo` (datasets y helpers)

**Archivos:**
- Crear: `packages/geo/` (`package.json` con `exports`, `tsconfig.json` como los otros paquetes, configuración de Vitest y script `test`/`check-types`), `packages/geo/src/index.ts`, `packages/geo/src/countries.ts` (metadatos: código, nombres de nivel es/en), `packages/geo/src/helpers.ts`, `packages/geo/src/data/us/regions.json` y `packages/geo/src/data/us/localities/<XX>.json` (uno por estado y DC), `packages/geo/src/data/ni/regions.json` y `packages/geo/src/data/ni/localities/<código>.json`, `packages/geo/scripts/generate-us.ts` (genera los JSON de EE. UU. desde `apps/web/src/data/us/*.ndjson`), pruebas en `packages/geo/src/test/`.
- Modificar: `pnpm-workspace`/`turbo` solo si hace falta registrar el paquete; `apps/api/package.json` y `apps/web/package.json` (dependencia `@repo/geo`); `pnpm-lock.yaml` (única instalación permitida: enlazar el paquete y Vitest).
- Eliminar (después de generar y verificar los JSON): `apps/web/src/data/us/*.ndjson`.

**Interfaces:**
- Produce:
  - `type CountryCode = 'US' | 'NI'`; `COUNTRIES: Record<CountryCode, { code; levels: [{ es: string; en: string }, { es: string; en: string }] }>` (EE. UU.: estado/state, ciudad/city; Nicaragua: departamento/department, municipio/municipality).
  - `regionsOf(country): { code: string; name: string }[]`.
  - `loadLocalities(country, region): Promise<string[]>` (nombres únicos ordenados, carga dinámica por archivo; en la API y en la web).
  - `isValidPlace(country, region?, locality?): Promise<boolean>` (la localidad debe pertenecer a la región).
  - `type Coverage = { scope: 'country' } | { scope: 'areas'; areas: { region: string; locality: string | null }[] }` y `coverageAllows(coverage, region?, locality?): boolean` (un área con `locality` nula cubre toda la región).
  - `levelLabel(country, level: 1 | 2, lang: 'es' | 'en'): string`; `regionName(country, code): string | undefined`.
- Consume: los `.ndjson` de EE. UU. (campos `address.city`, `address.state`, `address.ISO3166-2-lvl4`, tipos city/town/village/hamlet).

- [ ] **Paso 1: pruebas primero (rojo).** Helpers: regiones de EE. UU. = 50 estados + DC con código de dos letras y nombre; Nicaragua = 15 departamentos + 2 regiones autónomas; cada región tiene al menos una localidad; sin duplicados ni nombres vacíos ni espacios sobrantes; `isValidPlace` acepta una localidad de su región y rechaza una de otra región, una inexistente y una región desconocida; `coverageAllows` con `country`, con una región completa, con una localidad concreta y con zonas que no incluyen el lugar; `levelLabel` es/en.
- [ ] **Paso 2: paquete y datos.** Crear el paquete con las mismas convenciones que `@repo/schemas`. Escribir `generate-us.ts` (nombres únicos por estado, ordenados, sin vacíos) y ejecutarlo para producir los JSON; revisar el resultado y eliminar los `.ndjson`. Preparar a mano los datos de Nicaragua (departamentos, regiones autónomas del Caribe Norte y Sur, y municipios) y dejar en el reporte la lista de fuentes y la advertencia de que el usuario debe revisarlos.
- [ ] **Paso 3: helpers.** Implementar los helpers con carga dinámica de JSON (`import()` con atributo de tipo JSON compatible con Node y Next); sin dependencias nuevas salvo las de pruebas.
- [ ] **Paso 4: enlace y verde.** Registrar la dependencia en `api` y `web` (`pnpm install` una sola vez), `pnpm --filter @repo/geo check-types` y `test`, `pnpm --filter api check-types` y `pnpm --filter web check-types` (que sigan verdes: aún nadie lo usa).
- [ ] **Paso 5:** dejar en staged las rutas tocadas y detenerse; reporte con el tamaño de los datos y las fuentes de Nicaragua.

---

### Task 2: Backend (migración, configuración, cotización, evento, PDF)

**Archivos:**
- Modificar: `apps/api/src/db/schema/{quotes,events,clients,enums}.ts` (columnas nuevas; quitar `state`/`city` y el enum), `packages/schemas/src/{quotes,clients,enums,events}.ts` (quitar `stateSchema`, `STATE_NAMES`, `StateValue`; `region`/`locality` en cotización; filtro `states` → `regions`; cliente sin `state`/`city`), `apps/api/src/modules/quotes/*` (service, repository, resource, pdf), `apps/api/src/modules/events/*` (resource y la copia de la ubicación de la cotización al crear el evento), `apps/api/src/modules/clients/*` (resource, repository, orden y filtros), `apps/api/src/core/trpc/router.ts` (montar el router nuevo), `apps/api/src/db/seeds/*` (clientes, cotizaciones, eventos y demo con ubicación), `apps/api/src/db/scripts/verifyMultitenant.ts`, pruebas y fixtures que citen lo removido, `docs/backend/architecture.md`, runbook `docs/superpowers/runbooks/multitenant-cutover.md`.
- Crear: `apps/api/drizzle/0016_operating_location.sql` (+ snapshot y journal), `apps/api/src/db/schema/location.ts` (`tenantLocation`, `tenantLocationAreas`), `packages/schemas/src/location.ts`, `apps/api/src/modules/locationSettings/` (`locationSettings.{resource,repository,service,module,router}.ts`), pruebas (`locationSettings.*.int.test.ts`, `quotes.location.int.test.ts`, `migration.0016.int.test.ts`).

**Interfaces:**
- Produce:
  - Tablas `tenant_location` (`tenant_id` PK, `enabled`, `country`, `depth` 0–2, `scope` `country|areas`, `ask_address`, `updated_at`, `CHECK (NOT enabled OR (country IS NOT NULL AND depth IS NOT NULL AND scope IS NOT NULL))`) y `tenant_location_areas` (`tenant_id`, `region`, `locality` nullable, unicidad con nulos tratados como iguales), ambas con RLS.
  - Esquemas `updateLocationSettingsSchema` (`enabled`, `country`, `depth`, `scope`, `areas`, `askAddress`) y recurso `{ enabled, country, depth, scope, areas, askAddress }`.
  - Router `locationSettings`: `get`, `update` (valida y guarda atómicamente; rechaza lo incompleto sin escribir). Permiso: el recurso de Ajustes existente adecuado (`tax_rates` no; usar el recurso de configuración general; si no hay uno apto, crear `location_settings` con el patrón de `charge_type`).
  - Cotización: input `region?` y `locality?` (sin `country`); recurso y detalle con `country`, `region`, `locality`, `address`; filtro `regions: string[]`. Evento: `country`, `region`, `locality`, `address` copiados de la cotización.
- Consume: `@repo/geo` (`isValidPlace`, `coverageAllows`, `COUNTRIES`, `regionsOf`) de la tarea 1; el patrón de add-on/permiso del módulo de cargos como referencia de estructura.

- [ ] **Paso 1: pruebas primero (rojo).** `locationSettings`: activar completo (país, precisión, cobertura, dirección), activar incompleto rechazado sin escribir (y el `CHECK` de la base lo respalda), `scope = 'areas'` sin zonas rechazado, zonas inexistentes rechazadas, `depth` mayor al nivel del país rechazado, aislamiento por organización, permiso. `quotes.location`: con función activa exige hasta el nivel configurado, `country` siempre el de la configuración aunque el input lo traiga, región o localidad fuera de cobertura o de otra región rechazadas sin escribir, `address` exigida solo con `askAddress`, función apagada no exige ni cambia la ubicación y conserva lo guardado al editar otros campos, la regla de salida de borrador usa la configuración, filtro por `regions`; el evento recibe la ubicación de la cotización. `migration.0016`: conversión `state/city` → `country='US'`/`region`/`locality` para NY, NJ y CT, organizaciones con y sin datos (activadas con EE. UU./2/country/dirección frente a sin fila), clientes sin `state`/`city`, enum eliminado, datos guardados intactos.
- [ ] **Paso 2: esquema Drizzle, `@repo/schemas` y permisos.** Tablas nuevas y columnas; quitar el enum, `stateSchema`, `STATE_NAMES` y todos sus usos; permisos del módulo nuevo si hacen falta, con plantillas de rol y sus pruebas.
- [ ] **Paso 3: migración 0016.** `db:generate` y edición a mano: crear tablas con RLS y el `CHECK`; agregar `country/region/locality` a `quotes` y `events`; convertir (`UPDATE ... SET country='US', region=state::text, locality=city`); activar la ubicación solo en organizaciones con alguna cotización o evento con `state` (`enabled=true`, `country='US'`, `depth=2`, `scope='country'`, `ask_address=true`); luego `DROP` de `state` y `city` en `quotes`, `events`, `clients` y del enum. Verificar `when` y que `db:generate` no propone nada. Entradas en `verifyMultitenant`.
- [ ] **Paso 4: módulo `locationSettings`.** `resource → repository → service → module → router` con validación contra `@repo/geo`; errores propios en `ErrorCodes` con es/en en `api.json`.
- [ ] **Paso 5: cotización, evento, cliente y PDF.** Resolver la configuración del tenant dentro de la transacción; validar y fijar `country` en el servidor; ajustar la regla de salida de borrador y el filtro por región; el PDF combina `address`, `locality` y el nombre de la región (`regionName`); quitar `state`/`city` del cliente en esquemas, recurso, repositorio, orden y filtros.
- [ ] **Paso 6: seeds, docs y runbook.** Seeds neutros y demo con ubicación activa en EE. UU.; docs de arquitectura; runbook (migración 0016: conversión, organizaciones activadas, clientes descartados, rollback).
- [ ] **Paso 7: verde.** `pnpm --filter api check-types`, `pnpm --filter api test`, `pnpm --filter api test:int` completo en base descartable; grep de `stateSchema|STATE_NAMES|StateValue|stateEnum|citiesByState` sin usos en `apps/api` y `packages` (salvo migraciones y la lógica de conversión). La web puede quedar en rojo (tarea 3).
- [ ] **Paso 8:** dejar en staged las rutas tocadas y detenerse; reporte con las formas de API que consume la tarea 3.

---

### Task 3: Web (Ajustes, selectores y pantallas)

**Archivos:**
- Modificar: `apps/web/src/features/settings/*` (tarjeta nueva en General o Ajustes, helpers y pruebas), `apps/web/src/features/quotes/{helpers.ts,quotes.store.ts,components/builder/EventSection.tsx,components/builder/QuotePreview/index.tsx,components/detail/QuoteDetailCard.tsx,components/list/QuotesFilterChips.tsx}`, `apps/web/src/features/events/components/{EventCard.tsx,detail/EventHeader.tsx}`, `apps/web/src/features/clients/components/{columns.tsx,ClientCard.tsx,ClientForm.tsx,EditClientModal.tsx,detail/ClientInfoCard.tsx}` (sin `state`/`city`), `apps/web/src/components/shared/AddressLines.tsx`, locales `apps/web/src/locales/{es,en}/{quotes,settings,clients,events,common,api}.json`, `docs/frontend/architecture.md`.
- Crear: `apps/web/src/components/shared/LocationFields/` (componente y helpers puros con pruebas), `apps/web/src/features/settings/components/forms/LocationSettingsCard.tsx` y su hook tRPC, y las pruebas de los helpers nuevos.
- Eliminar: `apps/web/src/features/quotes/citiesByState.json`.

**Interfaces:**
- Consume (tareas 1 y 2): `@repo/geo` (`COUNTRIES`, `regionsOf`, `loadLocalities`, `coverageAllows`, `levelLabel`, `regionName`); router `locationSettings` (`get`, `update`); cotización con `country`, `region`, `locality`, `address` y filtro `regions`.
- Produce: `LocationFields({ settings, value, onChange, readOnly? })` (selectores encadenados con los nombres de nivel del país en el idioma activo, limitados a la cobertura, carga bajo demanda de localidades, exige el nivel según `depth`, muestra lo guardado aunque la función esté apagada) y helpers puros (`locationOptions`, `isLocationComplete`, `settingsPayload`, `isSettingsComplete`).

- [ ] **Paso 1: pruebas primero (rojo).** Helpers puros: opciones limitadas por cobertura (país, región completa, localidad concreta), `isLocationComplete` para cada `depth`, el payload de Ajustes solo se arma con el formulario completo y `isSettingsComplete` detecta cada faltante, nombres de nivel por idioma; paridad de locales es/en.
- [ ] **Paso 2: Ajustes.** Tarjeta "Ubicación de operación": interruptor; al activarlo aparece el formulario (país, cobertura todo el país o zonas con selector de regiones y localidades, precisión, pedir dirección) y solo se guarda al completarlo; si está incompleto el interruptor no se aplica y el mensaje indica qué falta; mobile-first; permisos con `<Can>`/`useCan`.
- [ ] **Paso 3: `LocationFields` y cotizador.** Reemplazar los selectores de estado y ciudad del cotizador por `LocationFields` y mostrar el campo de dirección solo si `askAddress`; con la función apagada no se pide nada y lo guardado se muestra; la regla de completitud usa la configuración.
- [ ] **Paso 4: lectores y filtros.** Detalle y vista previa de cotización, tarjeta y cabecera de evento, `AddressLines`, filtro por región en la lista de cotizaciones (reemplaza el de estado) y clientes sin estado/ciudad; eliminar `citiesByState.json` y todo uso de `STATE_NAMES`.
- [ ] **Paso 5: docs.** `docs/frontend/architecture.md`: sección breve de ubicación de operación, `LocationFields` y la regla "el país lo fija el servidor".
- [ ] **Paso 6: verde.** `pnpm check-types`, `pnpm test`, `pnpm --filter api test:int` completo en base descartable, `prettier --check` de lo tocado; grep de `citiesByState|STATE_NAMES|stateSchema` sin usos en `apps/web/src`. No se prueba en vivo: dejar en el reporte qué debe probar el usuario (activar y completar el formulario con EE. UU. y con Nicaragua, cotización con cada precisión, cobertura parcial, función apagada con datos guardados, una cotización migrada, filtro por región, clientes, móvil).
- [ ] **Paso 7:** dejar en staged las rutas tocadas y detenerse.
