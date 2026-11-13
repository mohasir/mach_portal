# Multi-tenant fase 1b: RLS como segunda barrera — diseño

Rama: `feat/mt-fase-1b-rls` (desde `multitenant`). Programa: `docs/superpowers/specs/2026-10-19-multitenant-fase1-design.md` (§6).

## 1. Objetivo y alcance

Hoy el aislamiento entre organizaciones depende de que cada consulta lleve `WHERE tenant_id` (`tenantEq`). Un olvido en una consulta nueva filtraría datos entre clientes. Esta fase añade una segunda barrera en Postgres (Row Level Security) para que la base de datos limite por organización aunque el código falle.

**Incluye:** roles de Postgres (`owner`, `app`, `platform`), políticas RLS en las tablas con `tenant_id`, transacción por petición que fija la organización, transacciones cortas para operaciones con llamadas externas lentas, dimensionado del pool, verificación al arrancar y suite de pruebas con el rol `app`.

**No incluye:** RLS en las tablas de autenticación de Better Auth (`user`, `session`, `account`, `verification`, `invitation`, `organization`, `member`); el panel `/platform` (fase 4); migrar al cliente real de `main`.

**Por qué las tablas de autenticación quedan fuera:** durante el login Better Auth las lee antes de que exista organización activa, y un usuario puede pertenecer a varias. Con RLS por organización el login no funcionaría. Siguen protegidas por el código, como hoy.

## 2. Entornos

| Entorno | Postgres | Notas |
|---|---|---|
| Local | Docker | Control total de roles. |
| Staging (`staging-mt`) | Neon | Roles por SQL; pooler opcional (pgBouncer en modo transacción). |
| Producción (probable) | Railway | Postgres estándar con usuario administrador; sin pooler por defecto. |

El diseño debe funcionar igual en los tres: no depende de funciones de un proveedor, y la organización activa se fija con `set_config(..., true)` (vale solo dentro de la transacción, compatible con pooler en modo transacción).

## 3. Roles de Postgres

- **`owner`**: dueño de las tablas; ejecuta las migraciones y `db:baseline`, `db:reset` y `db:roles` (el rol `platform` no puede crear el esquema `drizzle` ni borrar `public`). Debe tener `BYPASSRLS` (o ser superusuario; requisito que cumple el administrador del entorno, `db:roles` y `mt:verify` no lo comprueban) porque las migraciones de datos (como el backfill de roles) cruzan organizaciones; `FORCE` evita que el dueño de una tabla se salte las políticas por serlo, y solo este rol queda exento por atributo.
- **`app`**: lo usa la API en cada petición. Sin `SUPERUSER` ni `BYPASSRLS`. Solo `SELECT/INSERT/UPDATE/DELETE` sobre las tablas y uso de secuencias.
- **`platform`**: `BYPASSRLS`. Scripts (`tenant:create`, `mt:verify`, seeds) y, en la fase 4, el panel. Nunca atiende peticiones de usuarios.

Un administrador de plataforma (`user.isPlatformAdmin`) es una persona, no un rol de base de datos: cuando entra a una organización la API sigue usando `app` con esa organización fijada y solo ve esa, una a la vez.

**Creación:** script idempotente `db:roles`, ejecutado por el administrador de cada entorno. Crea los roles, concede permisos y fija `ALTER DEFAULT PRIVILEGES` para tablas futuras. Las contraseñas llegan por variables de entorno y no se imprimen ni se guardan en archivos.

**Variables de entorno:** `DATABASE_APP_URL` (rol `app`, la API; reemplaza a `DATABASE_URL`, que deja de leerse en todo el código sin fallback), `DATABASE_OWNER_URL` (migraciones, `db:roles`, `db:studio`) y `DATABASE_PLATFORM_URL` (scripts), `DB_POOL_MAX`. `db:roles` toma usuario y contraseña de los roles `app` y `platform` de `DATABASE_APP_URL` y `DATABASE_PLATFORM_URL` (no hay variables de contraseña aparte).

**Verificación al arrancar:** la API consulta `rolsuper` y `rolbypassrls` de `current_user` y no arranca si alguno es verdadero. En desarrollo local con un único usuario superusuario el arranque falla con un mensaje claro que apunta a `db:roles`.

## 4. Políticas RLS

Para cada tabla de `TENANT_TABLES` (`verifyMultitenant.ts`) y `platform_access_log`:

- `ENABLE` y `FORCE ROW LEVEL SECURITY` (para que ni el dueño las salte).
- Una política `FOR ALL` con `USING` y `WITH CHECK`: `tenant_id = current_setting('app.tenant_id', true)`.
- Sin organización fijada, `current_setting` devuelve nulo y la comparación no es verdadera: cero filas y los `INSERT` fallan. Falla cerrado.
- Se declaran con `pgPolicy` en el esquema Drizzle. La migración `0005` se genera con `db:generate`, se revisa y la aplica el usuario (no se usa `db:push`).
- `mt:verify` comprueba que cada tabla con `tenant_id` tiene RLS habilitado, forzado y con su política.

## 5. Transacción por petición

1. El middleware de la cadena de tRPC, tras resolver la organización activa, abre una transacción con el cliente de `app` y ejecuta `set_config('app.tenant_id', tenantId, true)`.
2. Eso ocurre antes de `resolveAccess`, porque `role` y `role_permission` ya tienen RLS.
3. `xModule(ctx)` recibe esa conexión (`ctx.db`) en lugar del `db` global; los repositorios no cambian de firma (`(db, tenantId)`), sigue habiendo `tenantEq` en cada consulta.
4. Las transacciones que abren hoy los repositorios (`this.db.transaction`) pasan a ser puntos de guardado dentro de la transacción de la petición.
5. Éxito: `COMMIT`. Error de la petición: `ROLLBACK`.
6. La ruta de subida de Express (`guardTenantSession`) hace lo mismo.
7. Procedures sin organización (públicos, de sesión, `tenant.list/select`) no abren esta transacción y usan el cliente `app` sin tenant fijado.

## 6. Operaciones con llamadas externas lentas

`generatePdf` (servicio de PDF) y `addPaymentAttachment` (subida a R2) no deben retener una conexión durante la llamada externa. Se marcan para que la cadena **no** abra la transacción larga y usan `withTenantTx`: transacciones cortas antes y después de la llamada. Si falla el guardado tras subir un archivo, se borra el archivo.

## 7. Código que cruza organizaciones o corre fuera de una petición

- `createTenant`, seeds, `mt:verify`, `tenant:create`, `db:baseline`, migraciones: rol `platform` u `owner` según corresponda, a través de sus propias variables de entorno.
- `platformAccess` (auditoría): se escribe durante la petición con `app` y la organización fijada; la política lo permite. Su lectura global es del panel (`platform`).
- Better Auth y `tenantResolver`: usan el cliente `app` sin tenant fijado; solo tocan tablas sin RLS.
- La FK compuesta `(role_id, tenant_id)` aparcada en la fase 2 se evalúa aquí como defensa extra.

## 8. Pool y dimensionado

- `DB_POOL_MAX` configurable (valor por defecto razonable para una instancia), documentado junto al límite de conexiones del plan de Postgres de cada entorno.
- Cada petición con tenant retiene una conexión de principio a fin; por eso las operaciones lentas son excepciones del punto 6.
- Prueba de carga en `staging-mt`. Plan B si el pool no alcanza: pgBouncer en modo transacción (ya compatible por usar `set_config(..., true)`; el cliente `postgres-js` se configura sin sentencias preparadas en ese caso).

## 9. Pruebas

- **Suite RLS nueva (rol `app`)**: consulta sin filtro devuelve solo la organización fijada; sin organización fijada devuelve cero filas; `INSERT` con `tenant_id` ajeno falla; `UPDATE` y `DELETE` sobre filas ajenas no afectan nada; verificación para cada tabla de la lista.
- **Rol `platform`** ve todas las organizaciones; **`app`** no puede ser `SUPERUSER`/`BYPASSRLS` (prueba del chequeo de arranque).
- Las pruebas de integración existentes siguen con un rol que se salta el RLS (prueban la lógica); el aislamiento lo prueba la suite nueva. El global setup crea los roles en la base de pruebas.
- Prueba de una petición completa por tRPC con el rol `app` y de la ruta de subida de Express.

## 10. Despliegue

Orden por entorno: crear roles (`db:roles`) → aplicar la `0005` con `owner` → definir `DATABASE_APP_URL` con el rol `app` → desplegar el código → `mt:verify`. Producción no se toca hasta completar todas las fases (runbook `multitenant-cutover.md`, que se actualiza con estos pasos).

## 11. Riesgos

- **Se olvida apuntar `DATABASE_APP_URL` al rol `app`:** el RLS no haría nada; mitigado por la verificación de arranque.
- **Agotar conexiones:** mitigado por el dimensionado y la prueba de carga.
- **Una consulta fuera de la transacción de la petición:** devuelve cero filas (falla cerrado), no filtra datos.
