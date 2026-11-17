# Ubicación de operación — diseño

Fecha: 2026-11-16. Fase 3 del programa de catálogo genérico (`2026-11-14-catalogo-generico-programa.md`). Rama `feat/ubicacion-operacion`, desde `multitenant`.

## 1. Objetivo

Reemplazar el `state` fijo (`NY`/`NJ`/`CT`) por una **ubicación de operación** que cada organización configura: dónde ofrece sus productos o servicios, con país, hasta dos niveles administrativos y la precisión que debe pedir la cotización. Datasets de EE. UU. y Nicaragua.

## 2. Decisiones (acordadas con el usuario)

- Es una **configuración de la organización**, no un add-on. La activa el admin en Ajustes con un interruptor; **no queda activa hasta que el formulario esté completo**.
- Los datasets son **archivos JSON compartidos** en un paquete (`@repo/geo`), uno por país. La cotización guarda el lugar como **copia en texto** (país, región, localidad), sin tablas de lugares ni claves foráneas a ellas.
- **La organización elige la precisión:** solo país (0), hasta nivel 1 (1) o hasta nivel 2 (2). La cotización pide exactamente ese nivel como obligatorio.
- El formulario permite cubrir **todo el país** o **solo ciertas zonas** (regiones, y opcionalmente localidades dentro de ellas); las opciones de la cotización se limitan a la cobertura.
- Una opción indica si la cotización **pide dirección** (la del servicio; no es un método de entrega).
- Apagada, la cotización no pide ubicación ni dirección; lo ya guardado se conserva y se sigue mostrando.
- **Cliente:** pierde `state` y `city` (los datos se descartan) y conserva solo `address` como texto.
- Se elimina por completo el enum `state` (`NY/NJ/CT`), `STATE_NAMES`, `stateSchema` y `citiesByState.json`.
- Países iniciales: **EE. UU. (`US`) y Nicaragua (`NI`)**; otro país se agrega cuando haya un cliente que lo necesite (un archivo más).

## 3. Datos

Migración 0016 (drizzle-kit, SQL revisado a mano; `when` estrictamente mayor que el de la 0015 y no futuro; `db:generate` no propone nada después; RLS como el resto).

- **`tenant_location`** (una fila por organización, `tenant_id` PK): `enabled` (boolean, default false), `country` (text, ISO 3166-1 alfa-2, nullable), `depth` (smallint 0–2, nullable), `scope` (`country` | `areas`), `ask_address` (boolean, default false), `updated_at`. Restricción: `enabled = true` exige `country`, `depth` y `scope` no nulos (`CHECK`).
- **`tenant_location_areas`** (`tenant_id`, `region` text, `locality` text nullable; PK `(tenant_id, region, locality)` con tratamiento de nulos): las zonas cubiertas cuando `scope = 'areas'`; `locality` nulo cubre toda la región.
- **`quotes` y `events`:** quitan `state` y `city`; agregan `country` (text), `region` (text) y `locality` (text), todos nullables; conservan `address`.
- **`clients`:** quita `state` y `city`; conserva `address`.
- Se elimina el enum `state` de la base de datos.
- **Conversión de datos existentes:** cada cotización o evento con `state` recibe `country = 'US'`, `region` = código del estado según el dataset (`NY`, `NJ`, `CT`) y `locality` = la `city` que tenía. Las organizaciones con alguna cotización o evento con estado quedan con `enabled = true`, `country = 'US'`, `depth = 2`, `scope = 'country'` y `ask_address = true` (el flujo de hoy); las demás quedan sin fila o apagadas. Los `state` y `city` de clientes se descartan.
- La migración lleva su prueba (conversión, organizaciones con y sin datos, clientes) y la entrada en `verifyMultitenant` para las tablas nuevas.

## 4. Paquete `@repo/geo`

- Un archivo por país con: código, nombres de nivel por idioma (`levels`: nombre del nivel 1 y 2 en es/en), `regions` (`code`, `name`) y las localidades por región.
- EE. UU.: regiones = los 50 estados y DC (código postal de dos letras); localidades por estado en archivos separados (cargados bajo demanda en la web y por la API al validar), generados por un script versionado desde `apps/web/src/data/us/*.ndjson`; los `.ndjson` fuente se eliminan del repo una vez generados los JSON.
- Nicaragua: 15 departamentos y 2 regiones autónomas (nivel 1) y sus municipios (nivel 2), preparados a mano y marcados para revisión del usuario.
- Helpers puros con pruebas: `getCountry(code)`, `regionsOf(country)`, `localitiesOf(country, region)`, `isValidPlace(country, region?, locality?)`, `coverageAllows(settings, region?, locality?)`, `levelLabel(country, level, lang)`.

## 5. API

- **Módulo `locationSettings`** (`resource → repository → service → router`, según `docs/backend/architecture.md`): `get`, `update` y `options`. `update` valida que el formulario esté completo (país válido; `depth` ≤ niveles del país; zonas existentes en el dataset; `scope = 'areas'` exige al menos una zona; `enabled = true` solo con todo lo requerido) y rechaza el resto sin escribir. Permiso propio sobre configuración (el mismo recurso que gobierna Ajustes, sin recurso nuevo si ya existe uno adecuado).
- **Cotización y evento:** el input reemplaza `state` y `city` por `region` y `locality` (el `country` lo fija el servidor desde la configuración, nunca el cliente). Con la función activa, la API exige hasta el nivel configurado, valida contra `@repo/geo` y contra la cobertura, y exige `address` solo si `ask_address`. Con la función apagada, no exige ni acepta cambios de ubicación y conserva lo guardado. La regla "una cotización solo sale de borrador si tiene lugar, dirección y líneas" usa la configuración vigente.
- Lectura de cotización y evento devuelve `country`, `region`, `locality` y `address`; el filtro de cotizaciones por estado pasa a filtrar por `region`.
- **Cliente:** se quitan `state` y `city` de esquemas, recurso, repositorio, orden y filtros.
- **PDF:** la dirección combina `address`, `locality` y el nombre de la región según el dataset.

## 6. Web

- **Ajustes:** tarjeta "Ubicación de operación": interruptor; al activarlo aparece el formulario (país con nombre de nivel por país, cobertura todo el país o zonas con selector, precisión, pedir dirección) y solo se guarda al completarlo; si está incompleto el interruptor no se aplica.
- **Componente `LocationFields`** (cotizador y edición de evento): selectores encadenados con los nombres de nivel del país, limitados a la cobertura, con carga bajo demanda de las localidades; solo con la función activa; muestra lo ya guardado aunque esté apagada.
- Se reemplazan los selectores de estado y ciudad del cotizador, el detalle y vista previa de cotización, la tarjeta y cabecera de evento, los filtros de la lista de cotizaciones y el formulario, columnas y tarjeta de clientes; se elimina `citiesByState.json`.
- Textos i18n es/en con paridad; mobile-first; sin hex ni estilos en línea.

## 7. Pruebas

- `@repo/geo`: cada helper, cobertura por país y datos íntegros (los 50 estados + DC; 15 departamentos y 2 regiones autónomas).
- API: configuración incompleta rechazada y no activa; validación por precisión (0, 1, 2) y cobertura; país tomado de la configuración y no del input; función apagada conserva datos; aislamiento por organización; migración 0016 (conversión y clientes); filtro por región.
- Web: helpers de cobertura y de selección encadenada, paridad de locales; no se prueba en vivo.
- El usuario verifica en el navegador (activar y completar el formulario, cotización con cada precisión, una organización con cobertura parcial, datos migrados, móvil).

## 8. Fuera de alcance

- Más países además de EE. UU. y Nicaragua.
- Entregas o métodos de envío, y cálculo de costos por zona.
- Más de dos niveles administrativos.
- Impuestos o precios por ubicación.

## 9. Rama

`feat/ubicacion-operacion`, creada desde `multitenant`. Integración con merge `--no-ff` y push cuando el usuario lo pida.
