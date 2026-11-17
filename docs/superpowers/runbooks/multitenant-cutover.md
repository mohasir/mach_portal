# Runbook — Cutover multi-tenant (fase 1)

Convierte la base actual (un solo cliente, creada con `drizzle-kit push`) en el tenant #1 de la instalación multi-tenant. Spec: `docs/superpowers/specs/2026-10-19-multitenant-fase1-design.md` (§7). Todos los comandos se ejecutan desde la raíz del repo con las variables de conexión de la base objetivo (sección 7: cada script usa `DATABASE_OWNER_URL`, `DATABASE_PLATFORM_URL` o `DATABASE_APP_URL`; `pg_dump`, `pg_restore`, `db:baseline` y `db:migrate` usan `DATABASE_OWNER_URL`, `mt:verify` usa `DATABASE_PLATFORM_URL`). **Antes del paso 2 hay que crear los roles (`db:roles`, sección 7), porque `mt:verify` usa el rol `platform`.**

> **No subir a producción hasta completar todas las fases** (incluida la 1b, RLS: sección 7). Este runbook se usa primero en los ensayos sobre `staging-mt` y solo después en producción.

## 0. Decisiones y acciones previas (antes de la ventana)

- [ ] **Rotar la contraseña de `samuel@admin.com`** si todavía es la del seed por defecto: la migración la convierte en administrador de plataforma.
- [ ] **Decisión pendiente: restablecer o no las filas globales de `quote_stages` a los valores por defecto del seed.** La migración copia las personalizaciones actuales (label, color, description) de cada etapa al overlay `quote_stage_settings` del tenant #1 y **no toca** las filas globales. Si se quiere que los tenants nuevos partan de los valores por defecto del producto y no de las personalizaciones del cliente actual, hay que restablecer esas filas globales **después** del cutover y de `mt:verify`. Ojo: `db:seed` (`seeds/quoteStages.ts`) solo inserta etapas que faltan y **no sobrescribe** las existentes, así que el restablecimiento requiere un `UPDATE` manual revisado con los valores de `quoteStages.ts`. Nunca antes de que la migración copie el overlay.
- [ ] Definir el **host único** de cada entorno (hoy `oravitech.com` en Cloudflare; p. ej. `portal.oravitech.com`) y la URL con la que el cliente actual seguirá entrando.
- [ ] Verificar que `DATABASE_OWNER_URL` del cutover (la que usan `db:baseline` y `db:migrate`) es una **conexión directa** a Postgres (no pooler), ver paso 5.
- [ ] Verificar el límite de intentos de login (sección 5).
- [ ] Avisar la ventana de mantenimiento al cliente.

## 1. Entornos y variables

Valores por servicio (no hay comodines ni dominios por cliente: **un único host**):

| Servicio | Variable | Valor |
| --- | --- | --- |
| API | `DATABASE_APP_URL` | Rol `app` (sección 7); no se usa para migrar ni para respaldar. Railway y Neon inyectan `DATABASE_URL`: la API la ignora, hay que copiar su valor a mano en la variable que corresponda (sección 7.1) |
| Cutover / scripts | `DATABASE_OWNER_URL`, `DATABASE_PLATFORM_URL` | Conexión directa a Postgres (no pooler); ver sección 7.1 |
| API | `BETTER_AUTH_URL` | URL pública de la API |
| API | `WEB_ORIGIN` | Lista fija de orígenes permitidos separada por comas (CORS y `trustedOrigins`); normalmente solo `https://<host-único>`, sin barra final |
| API | `WEB_APP_URL` | Origen canónico de la web para enlaces de contraseña y notificaciones (`https://<host-único>`) |
| API | `BETTER_AUTH_SECRET`, `R2_*`, `PDF_SERVICE_URL`, `PDF_SERVICE_API_KEY`, `PORT` | Como hoy; en `staging-mt` valores propios |
| Web | `API_URL` | URL interna/pública de la API (la web hace proxy de `/api/auth`, `/trpc` y `/api/uploads`) |
| Web | `BETTER_AUTH_SECRET` | El mismo que la API |

- **Ya no se usan** y deben **quitarse** de los entornos desplegados: `APP_BASE_DOMAIN`, `APP_PROTOCOL`, `INTERNAL_PROXY_KEY` (y el reenvío del host).
- La web no tiene lógica de tenant: el tenant sale de la sesión. Agregar un cliente nuevo **no** requiere tocar DNS, certificados ni variables.
- Cookie de sesión de host único (sin `Domain`).
- La API debe correr con `NODE_ENV=production` en todo entorno desplegado: activa el límite de intentos de login, el encabezado HSTS y oculta las trazas de error de Express.

### `staging-mt` (aislado)

- Servicios propios (web, API y base) y **su propio host** (un único host, sin wildcard).
- Base restaurada desde un snapshot de producción, con acceso restringido.
- **Bucket y credenciales de R2 propios** (nunca compartir con producción: los archivos y URLs guardadas no se migran).
- **Correo desactivado o redirigido** a un buzón de prueba (los enlaces de contraseña y las notificaciones no deben llegar a clientes reales).
- **Crons desactivados.** En esta fase `server.ts` no programa crons: no hay recordatorios automáticos. Cuando se necesiten, correrlos a mano: `pnpm --filter api jobs:event-reminders -- --tenant=<slug>` (una organización) o `-- --all` (todas).
- `WEB_ORIGIN` y `WEB_APP_URL` con el host de staging-mt.

## 2. Ensayos (mínimo dos, con snapshot de producción)

Repetir las secciones 3 y 4 completas sobre un **snapshot restaurado de producción** en `staging-mt`; el último ensayo se hace siguiendo este runbook tal cual. Registrar los tiempos de cada paso (backup, `mt:verify --pre`, migración, `mt:verify`).

Comprobación adicional obligatoria en el primer ensayo (**esquema real de producción vs. 0000**): antes de `db:baseline`, comparar el esquema del snapshot restaurado contra el de una base nueva creada con la migración `0000` (en una base descartable: `pnpm --filter api db:reset` —destruye el esquema `public`— y ejecutar el SQL de `apps/api/drizzle/0000_baseline.sql` con `psql`; o `pg_dump --schema-only` de ambas y `diff`). Deben coincidir en columnas, constraints (nombres incluidos) e índices. La migración `0001` elimina por nombre exacto 6 uniques y 3 claves primarias; si el nombre real en producción difiere, la migración aborta (sin efecto, es transaccional) y hay que corregir antes del cutover. `mt:verify --pre` ya comprueba la existencia de esos nombres, pero la comparación completa detecta además diferencias de columnas o defaults.

Cada ensayo debe terminar con el checklist de regresión (`multitenant-regression-checklist.md`) ejecutado sobre la base migrada.

## 3. Cutover

Ventana de mantenimiento con **escrituras bloqueadas** (web en modo mantenimiento o API detenida).

1. **Backup** y prueba de restauración:
   ```bash
   pg_dump --format=custom --no-owner "$DATABASE_OWNER_URL" -f mach_pre_mt_$(date +%Y%m%d%H%M).dump
   ```
   Se respalda con el dueño (`DATABASE_OWNER_URL`): un dump hecho como `app` queda vacío o incompleto por el RLS. Restaurar el dump en una base de prueba y comprobar que abre. Sin backup restaurable no se continúa.
2. **Pre-verificación** (solo `SELECT`; conservar la salida). Debe terminar con exit 0:
   ```bash
   pnpm --filter api mt:verify --pre > verify-pre.txt
   ```
   Comprueba que existen las 9 constraints que la migración elimina, que `app_settings` no tiene filas distintas de `id = 1`, duplicados contra las futuras claves por tenant, y avisa de roles tipo `super admin` que no sean exactamente `superadmin` (esos usuarios no serían administradores de plataforma).

   Con las migraciones de roles (0002–0004) también avisa de las organizaciones sin ningún miembro `superadmin`: tras migrar quedarían sin dueño y un administrador de plataforma debe asignar el rol dueño con `users.update`. Las migraciones 0002–0004 se aplican con la app detenida y el código nuevo se despliega en el mismo paso (ver `docs/backend/architecture.md` §8).

   **Revisar la lista `superadmins:`** que imprime. Un administrador de plataforma puede seleccionar **cualquier** organización, así que el personal `superadmin` del cliente **no** debe recibir ese flag (siguen siendo `superadmin` dentro de su propio tenant). Elegir solo las cuentas del equipo de plataforma y comprobar la lista (case-insensitive, separada por comas; falla si un email no existe):
   ```bash
   pnpm --filter api mt:verify --pre --platform-admin-emails=<a@x,b@y> >> verify-pre.txt
   ```
   La línea `platform admins after 0001 (from the list): …` debe mostrar exactamente esas cuentas. Sin lista, `0001` promueve a **todos** los `superadmin` (solo aceptable si todos son del equipo de plataforma).
3. **`db:baseline`, una sola vez por base creada con `push`** (producción y el staging actual no tienen filas en `drizzle.__drizzle_migrations`). Registra la migración `0000` como aplicada; se niega a correr si ya está registrada:
   ```bash
   pnpm --filter api db:baseline
   ```
4. **Conexión directa.** `DATABASE_OWNER_URL` debe apuntar **directo a Postgres**, no a un pooler (PgBouncer en modo transacción, endpoints pooled de Neon/Supabase). Los parámetros `--set` viajan en el parámetro de arranque `options`, que los poolers rechazan o descartan en silencio; si se descarta, la migración falla con "needs the tenant #1 slug" aunque se haya pasado `--set`.
5. **Migrar** (una sola transacción: si falla, no cambia nada). El slug es el identificador estable e inmutable del tenant (`^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$`); el nombre admite espacios:
   ```bash
   pnpm --filter api db:migrate --set mt.tenant_slug=<slug> --set mt.tenant_name="<Nombre del cliente>" --set mt.platform_admin_emails=<a@x,b@y>
   ```
   La migración `0001`: crea la organización; un `member` por usuario con su rol actual; marca `isPlatformAdmin` solo a las cuentas de `mt.platform_admin_emails` (aborta sin cambios si alguna no existe) o, si no se pasa, a quienes tienen `superadmin` entre sus roles (**siguen siendo también miembros del tenant #1**, por lo que su acceso a él no se audita en `platform_access_log`); fija la organización activa en **todas** las sesiones abiertas (nadie se desconecta); rellena `tenant_id` en las 25 tablas de negocio; convierte `app_settings` en la fila del tenant; copia las etapas de cotización al overlay `quote_stage_settings`; luego endurece (`NOT NULL`, FK, índices, uniques y PK por tenant). Los archivos de R2 y las URLs de PDFs guardadas no se tocan. En caso de error, el CLI imprime primero el motivo de la base (el texto del `RAISE`).
6. **Verificar** (debe terminar con exit 0) y comparar con la pre-verificación:
   ```bash
   pnpm --filter api mt:verify > verify-post.txt
   ```
   Los conteos por tabla deben ser iguales a los de `verify-pre.txt`, más `organization` = 1, `member` = número de usuarios y `quote_stage_settings` = número de etapas. No debe haber filas sin `tenant_id`, huérfanas, duplicados ni usuarios sin membresía (los administradores de plataforma sin membresía están exentos).
7. **Deriva de esquema** (solo archivos, sin base):
   ```bash
   pnpm --filter api db:generate           # debe decir "No schema changes"; si crea un archivo, borrarlo e investigar
   pnpm --filter api exec drizzle-kit check # debe decir "Everything's fine"
   ```
8. **Desplegar la versión multi-tenant** de API y web con las variables de la sección 1 (sin `APP_BASE_DOMAIN`, `APP_PROTOCOL` ni `INTERNAL_PROXY_KEY`).
9. **Smoke tests** (mínimos; el checklist completo es `multitenant-regression-checklist.md`):
   - Login del administrador del cliente: entra directo a `/admin` (una sola organización).
   - Listas de clientes, cotizaciones y eventos con los mismos conteos de siempre.
   - Abrir una cotización existente y generar su PDF.
   - Ver un adjunto de pago existente.
   - Login de un admin de plataforma: pantalla de selección, aviso "modo plataforma".
   - Crear un cliente de prueba y borrarlo.
   - Una sesión que estaba abierta antes del cutover sigue funcionando.
10. **Abrir** (quitar el modo mantenimiento) y vigilar logs.

## 4. Reversión

No hay migración inversa. La reversión es **restaurar el backup del paso 1 y desplegar la versión anterior** de API y web; se pierde todo lo escrito después del cutover.

- **Ventana de decisión:** corta y acordada de antemano (propuesta: 60 minutos desde la apertura; fuera de ella, corregir hacia adelante).
- **Criterios de reversión** (cualquiera, dentro de la ventana):
  - `mt:verify` termina con problemas que no se corrigen con una sentencia segura.
  - Un smoke test falla en login, listas, cotizaciones o PDF sin corrección rápida.
  - Cualquier señal de datos visibles entre organizaciones.
  - Errores 5xx sostenidos en la API.
- Si falla el paso 5 (migración), la base queda intacta: corregir la causa y repetir, sin restaurar.
- Restaurar: `pg_restore --clean --if-exists -d "$DATABASE_OWNER_URL" <dump>`.

## 5. Comportamientos a tener presentes

- **Límite de intentos de login (Better Auth).** El código no lo configura: depende del valor por defecto de Better Auth, que solo está activo con `NODE_ENV=production`. **El contador se agrupa por la IP que Better Auth lee de `X-Forwarded-For`**, y ese encabezado lo controla el cliente salvo que el proxy de entrada (Railway u otro) lo **sobrescriba** con la IP real (no que le agregue un valor al final). Verificar que el proxy lo sobrescribe: con un `X-Forwarded-For` aleatorio enviado por el cliente, el login debe seguir respondiendo 429 después del límite. Si no se puede garantizar, configurar `advanced.ipAddress.ipAddressHeaders` en `lib/auth.ts` con el encabezado que fija el proxy antes del cutover. Verificar en cada entorno desplegado (incluido `staging-mt`) que está activo repitiendo intentos fallidos contra `/api/auth/sign-in/email` hasta recibir 429. Si el entorno no corre con `NODE_ENV=production`, o hay varias instancias de la API (el contador por defecto es en memoria, por instancia), configurarlo explícitamente antes del cutover.
- **Retraso al dar de baja una organización o a un miembro.**
  - Caché de cookie de sesión (60 s, `lib/auth.ts`; antes 300 s): las lecturas de sesión que la usan —el `middleware.ts` de la web y `/api/auth/get-session`— pueden ver durante hasta 1 minuto una sesión con datos viejos o ya cerrada si se reenvían las cookies viejas. Se mantiene activa (no se desactiva) porque el middleware de la web decide redirecciones (rol, `mustChangePassword`) con ella sin consultar la base; desactivarla dejaría esas redirecciones solo en manos de la API. tRPC y la ruta de adjuntos no la usan (leen la sesión sin caché y re-verifican la membresía en cada petición), así que sacar a alguien de la organización surte efecto en su siguiente petición de datos.
  - Caché de organización (60 s, en memoria por instancia): el nombre y la existencia de una organización (borrada o renombrada) tardan hasta ~60 s en reflejarse. En la fase 1 no hay baja ni renombre desde la UI; si se hace a mano, esperar ese tiempo.
- **Crons deshabilitados** en esta fase (ver sección 1).
- **Sesión sin organización:** los usuarios con varias membresías verán la pantalla de selección tras iniciar sesión; los que no tienen ninguna (salvo administradores de plataforma) no pueden entrar (`USER_NO_ORGANIZATION`).

## 6. Cambios de esquema que llegan a `main` con `push` mientras la rama `multitenant` está abierta

`main` sigue usando `db:push`; la rama `multitenant` usa migraciones y ya no tiene el script `db:push`. Cada vez que se fusiona `main` en `multitenant`:

1. Revisar el diff de `apps/api/src/db/schema/` que trae `main` (`git diff <base>..main -- apps/api/src/db/schema`).
2. Para cada cambio de esquema, aplicarlo también al esquema TS de la rama (el merge ya lo hace) y, si es una tabla de negocio nueva, **agregarle `tenantId`** (helper `db/schema/tenantColumn.ts`) y su repository `(db, tenantId)` según `docs/backend/architecture.md` §11; la guarda `tenantTables.test.ts` fallará si falta.
3. Generar la migración: `pnpm --filter api db:generate`. Revisar y, si hace falta, editar a mano el SQL (datos existentes en producción: backfill de `tenant_id` con el tenant #1 antes de `SET NOT NULL`, igual que en `0001`).
4. Si el cambio de `main` ya está aplicado en producción vía `push` y la migración `0001` aún no se ejecutó, **editar `0001`** (o regenerar antes de producción) en lugar de agregar una migración posterior, y repetir el ensayo; después del cutover, solo migraciones nuevas.
5. Comprobar `db:generate` ("No schema changes") y `drizzle-kit check`, correr `pnpm --filter api test:int` y repetir el ensayo de la sección 2 si el cambio toca datos.
6. Después del cutover, `drizzle-kit push` queda prohibido en cualquier base compartida (la rama ya no expone `db:push`).

## 7. Fase 1b: RLS (roles, migración `0005` y variables)

Spec: `docs/superpowers/specs/2026-11-08-multitenant-fase1b-rls-design.md`. Arquitectura: `docs/backend/architecture.md` §12.

### 7.1 Variables nuevas

| Variable | Rol / uso | La leen |
| --- | --- | --- |
| `DATABASE_APP_URL` | rol **`app`** (sin `SUPERUSER`, `BYPASSRLS` ni `CREATEROLE`) | API, jobs, `db:roles` (toma usuario y contraseña del rol), `mt:verify` (opcional, comprueba el rol de la API) |
| `DATABASE_OWNER_URL` | **owner** (dueño de las tablas; debe poder cruzar organizaciones, ver nota abajo) | `db:roles` (se conecta con ella), `db:migrate`, `db:reset`, `db:baseline`, `db:studio` |
| `DATABASE_PLATFORM_URL` | rol **`platform`** (`BYPASSRLS`) | `db:seed`, `tenant:create`, `mt:verify`, `db:roles` (toma usuario y contraseña del rol) |
| `DB_POOL_MAX` (por defecto 10) | conexiones de la API para las transacciones de petición | API |
| `DB_AUTH_POOL_MAX` (por defecto 3) | pool propio de Better Auth | API |

- Las contraseñas y las URL viven solo en variables de entorno o en el gestor de secretos del entorno; nunca en el repo.
- Ningún script cae a otra variable: si falta la suya, falla con un mensaje claro. **`DATABASE_URL` ya no se lee en ningún lado:** Railway y Neon la inyectan con la URL de su usuario administrador; hay que mapearla a mano (a `DATABASE_OWNER_URL` si es el administrador, y crear `DATABASE_APP_URL` con el rol `app`) y no dejar que la API dependa de ella.
- **`db:roles` no tiene variables de contraseña propias:** se conecta con `DATABASE_OWNER_URL` y crea (o actualiza) los roles con el **usuario y la contraseña** de `DATABASE_APP_URL` y `DATABASE_PLATFORM_URL`. Ambas son obligatorias; falla nombrando la variable si falta alguna o si no trae usuario o contraseña, y si los dos usuarios coinciden entre sí o con el owner. La contraseña va codificada en la URL (`encodeURIComponent`) si tiene `@ : / % ? #`…; `db:roles` la decodifica igual que el driver, así que la misma URL sirve para conectar. No imprime URLs ni contraseñas.
- `db:fresh` (`db:preflight` + reset + `db:roles` + migrate + seed) también necesita esas tres URLs: el reset borra `public` y con él los permisos de `app`, así que re-ejecuta `db:roles`.
- **`db:studio` usa `DATABASE_OWNER_URL`** y por eso ve las filas de **todas** las organizaciones. No apuntarlo a producción con esa credencial sin necesidad (y nunca dejarlo abierto). `db:generate` no se conecta a la base.
- **El owner debe tener `BYPASSRLS`** (o ser superusuario): es un requisito que debe cumplir el administrador de cada entorno. En local se cumple porque el administrador es superusuario; `db:roles` y `mt:verify` **no lo comprueban ni lo fijan**. Las migraciones posteriores a la `0005` que toquen datos lo necesitan: sin él verían cero filas. Comprobarlo en cada entorno (en especial Neon y Railway) conectando con `DATABASE_OWNER_URL`: `SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user;` (alguna de las dos debe ser `true`). En Neon, si el owner no lo tiene, tampoco puede crear un `platform` con `BYPASSRLS` y `db:roles` falla.
- `db:baseline` usa **owner** (el rol `platform` no puede crear el esquema `drizzle`).

### 7.2 Dimensionado del pool

- Conexiones por instancia de la API = `DB_POOL_MAX + DB_AUTH_POOL_MAX` (por defecto 13). Total = eso por el número de instancias, más lo que usen scripts y consolas; debe quedar **por debajo del límite de conexiones del plan** de Postgres de cada entorno.
- Cada petición con tenant retiene una conexión de principio a fin (la web agrupa hasta 20 llamadas por lote). Si el pool no alcanza, las peticiones esperan (no fallan): vigilar la latencia.
- **Prueba de carga en `staging-mt` (Neon) antes de producción:** lotes de lecturas concurrentes de varias organizaciones, más generación de PDF y subidas de adjuntos en paralelo; comprobar que no hay esperas largas ni conexiones `idle in transaction` durante las llamadas externas (`pg_stat_activity`).
- **Plan B: pgBouncer en modo transacción.** Es compatible porque el tenant se fija con `set_config(..., true)` (vale solo dentro de la transacción). Hoy **no** se usa `prepare: false`: solo hay que añadirlo si se pasa al plan B, en todos los clientes `postgres-js` (`db/index.ts`, el pool de Better Auth `authQueryClient` y `platformDb`). Las migraciones (`DATABASE_OWNER_URL`) siguen yendo por conexión directa (sección 3, paso 4).

### 7.3 Orden por entorno

La `0005` **solo se aplica junto con el código de la transacción por petición y de los módulos sobre `ctx.db`**: después de ella, cualquier rol sin `BYPASSRLS` no ve nada hasta que la petición fije `app.tenant_id`. Y la API se niega a arrancar si el rol de `DATABASE_APP_URL` es superusuario, tiene `BYPASSRLS` o `CREATEROLE`, o es miembro de un rol que salta el RLS.

**La `0005` nunca debe llegar a un entorno sin ese código.** Ninguna rama ni commit desplegable puede contener la migración sin la transacción por petición, los módulos sobre `ctx.db` y la verificación de rol al arrancar: integrar todo en un único PR o, si se separa en commits, que el de la migración sea el último.

Por eso el orden es:

1. **Crear los roles** con el usuario administrador del entorno:
   ```bash
   DATABASE_OWNER_URL=<url-admin> DATABASE_APP_URL=<url-app> DATABASE_PLATFORM_URL=<url-platform> pnpm --filter api db:roles
   ```
   Los roles toman nombre y contraseña de `<url-app>` y `<url-platform>` (por ejemplo `postgres://app:<contraseña-codificada>@<host>/<base>`). Es idempotente: re-ejecutarlo con otra contraseña en la URL la rota. En una base antigua hay que hacerlo **antes** de `mt:verify --pre` (usa `platform`).
2. **Aplicar la `0005`** con owner (`db:migrate`, `DATABASE_OWNER_URL`), con la app detenida o con el código nuevo desplegado en el mismo paso.
3. **Definir `DATABASE_APP_URL` con el rol `app`** (y `DATABASE_OWNER_URL`, `DATABASE_PLATFORM_URL`, `DB_POOL_MAX`, `DB_AUTH_POOL_MAX`) en la API; quitar o ignorar la `DATABASE_URL` que inyecte el proveedor.
4. **Desplegar el código** (API y web).
5. **`mt:verify`** con `DATABASE_PLATFORM_URL` (y `DATABASE_APP_URL` definida, para que también compruebe el rol de la API): debe terminar con exit 0, con las 30 tablas con RLS habilitado, forzado y con su política.

Por entorno:

- **Docker local** (`docker-compose.yaml`: usuario `mach_admin`, base `mach_db`): `DATABASE_OWNER_URL=postgres://mach_admin:<contraseña-del-compose>@localhost:5432/mach_db`; los roles `app` y `platform` los crea `db:roles` en esa misma base, así que `DATABASE_APP_URL=postgres://app:<contraseña-app>@localhost:5432/mach_db` y `DATABASE_PLATFORM_URL=postgres://platform:<contraseña-platform>@localhost:5432/mach_db` (las contraseñas se eligen ahí mismo; `db:roles` las asigna). Actualizar el `.env` y correr `pnpm --filter api db:fresh` (reset + `db:roles` + migrate + seed) y `mt:verify`.
- **Neon (`staging-mt`):** los roles creados desde la consola de Neon pertenecen a `neon_superuser` (se salta el RLS y la API no arranca): crear `app` y `platform` **con `db:roles`**, no desde la consola. Usar la conexión directa para migrar (sección 3, paso 4). Hacer aquí la prueba de carga (7.2).
- **Railway (producción, probable):** Postgres estándar con usuario administrador y sin pooler por defecto. Mismo orden; no se toca hasta completar todas las fases.

### 7.4 Reversión de la fase 1b

- Si falla antes de aplicar la `0005`: nada que revertir (los roles creados son inocuos).
- La `0005` no tiene migración inversa. Para volver atrás: restaurar el backup (sección 4) y desplegar la versión anterior. Mientras se decide, apuntar `DATABASE_APP_URL` a un rol con `BYPASSRLS` **no** sirve con el código nuevo (la API se niega a arrancar).

### 7.5 Pendiente / decisiones aparcadas

- **FK compuestas `(x_id, tenant_id)`:** Postgres verifica las FK sin RLS, así que hoy solo la resolución de ids en los repositories (`architecture.md` §11.4) impide referenciar filas de otro tenant. Decidir en un seguimiento si se migran ~29 tablas.
- **`server.ts` no maneja el apagado ordenado:** las tareas de PDF en segundo plano (`afterCommit`) que estén pendientes se pierden al reiniciar la API. Reintento: `quotes.regeneratePdf`.
- **2 filas `own` heredadas en `role_permission`** (de la migración de roles) a revisar.
- **Eliminar `user.role` y `member.role`** (columnas heredadas que ya no autorizan) en una fase posterior.

## 8. Fase 4a: módulos y add-ons por organización (migración `0006`)

Spec: `docs/superpowers/specs/2026-11-13-multitenant-fase4a-features-design.md`. Arquitectura: `docs/backend/architecture.md` §13. **Nada de esta sección se ejecuta contra producción sin la aprobación del dueño del proyecto.**

### 8.1 Qué hace la `0006`

`apps/api/drizzle/0006_tenant_features.sql`:

- Crea `tenant_features` (con su política `tenant_features_tenant_read`, solo `SELECT`) y `tenant_feature_events` (RLS sin política); las dos con `ENABLE` y `FORCE ROW LEVEL SECURITY`.
- Añade la columna `products.price` (centavos por unidad, nullable).
- **Relleno de las organizaciones existentes:** inserta, para cada `organization`, 5 filas **permanentes** (`expires_at` `NULL`) y sin precio: `quotes`, `events`, `notifications`, `priceTiers` y `configurableOptions`. Así no se quita funcionalidad a nadie. El add-on `productGallery` no se rellena: las imágenes de producto son nuevas en esta línea, y se activa por organización con `feature:set` cuando se contrate. El relleno corre antes del `FORCE`, porque después el propio dueño que migra quedaría sujeto a la política de solo lectura.

### 8.2 Organizaciones nuevas

`tenant:create` **no** activa ninguna feature: una organización nueva nace solo con el núcleo (sin `quotes`, `events`, etc.). Quien la crea debe activar lo contratado justo después, con el rol `platform` (`DATABASE_PLATFORM_URL`). El orden importa: **`quotes` antes que `events`** (`events` la requiere; si no, falla con `FEATURE_MISSING_DEPENDENCY`).

```bash
pnpm --filter api tenant:create --slug=<slug> --name=<name> --admin-email=<email> --admin-name=<name>
pnpm --filter api feature:set --tenant <slug> --key quotes
pnpm --filter api feature:set --tenant <slug> --key events
pnpm --filter api feature:set --tenant <slug> --key notifications
pnpm --filter api feature:set --tenant <slug> --key priceTiers --price <centavos> --period monthly --currency USD
pnpm --filter api feature:list --tenant <slug>
```

- `--expires YYYY-MM-DD` es el último día activo; sin él, la feature es permanente. El precio es informativo.
- La caché de la API (30 s por organización) hace que el cambio se aplique en hasta 30 s; no hay que reiniciar la API.

### 8.3 Orden de despliegue

Aplicar la `0006` con `db:migrate` (`DATABASE_OWNER_URL`) y desplegar API y web de la misma versión. El código nuevo necesita las tablas y `products.price`: sin la migración, la lectura de features falla (queda solo el núcleo activo) y las consultas de productos fallan. **La migración va antes que el código.**

### 8.4 Verificación

`mt:verify` (con `DATABASE_PLATFORM_URL`) debe terminar con exit 0. Además de lo de la sección 7.3 comprueba: RLS habilitado y forzado en las dos tablas, `tenant_features` con solo la política `tenant_features_tenant_read`, `tenant_feature_events` sin políticas, ninguna fila con clave `core` o desconocida, y ninguna organización con `events` activo sin `quotes`. Después, `feature:list --tenant <slug>` en una organización existente debe mostrar las 5 features activas.

### 8.5 Reversión

La `0006` solo agrega tablas, una columna y filas; no modifica datos existentes. No hay migración inversa en el repo.

**Reversión recomendada: restaurar el backup previo a la migración (sección 4) y desplegar la versión anterior de API y web.** Es la única vía que deja la base y el registro de migraciones de drizzle consistentes.

Reversión manual (solo si no se puede restaurar), con el dueño (`DATABASE_OWNER_URL`):

```sql
DROP TABLE tenant_feature_events;
DROP TABLE tenant_features;
ALTER TABLE products DROP COLUMN price;
DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1794598857324;
```

- El último `DELETE` es obligatorio: `db:migrate` guarda cada migración aplicada en `drizzle.__drizzle_migrations` (el valor de `created_at` es el `when` de la `0006` en `apps/api/drizzle/meta/_journal.json`). Si esa fila queda, un `db:migrate` posterior da la `0006` por aplicada y no recrea las tablas ni la columna.
- Se pierden con las tablas todas las filas cargadas en ellas, incluido el backfill de las 5 features a las organizaciones existentes (se vuelve a generar al re-aplicar la `0006`, pero los cambios hechos con `feature:set`/`feature:unset` y el historial de `tenant_feature_events` no).
- Eliminar `products.price` descarta los precios fijos cargados desde la fase.

---

## 9. Catálogo genérico, fase 1 (migraciones `0007`–`0013`)

Spec: `docs/superpowers/specs/2026-11-14-catalogo-generico-fase1-design.md`. Arquitectura: `docs/backend/architecture.md` §14. **Nada de esta sección se ejecuta contra producción sin la aprobación del dueño del proyecto.**

### 9.1 Qué hacen las migraciones

Se aplican en orden con `db:migrate` (`DATABASE_OWNER_URL`):

| Migración | Efecto |
| --- | --- |
| `0007_quantity_rename` | Renombra `quote_lines.num_persons` y `product_price_tiers.num_persons` a `quantity` (y sus restricciones). Sin pérdida de datos. |
| `0008_tenant_profile` | Crea `tenant_profile` (RLS solo lectura, `FORCE`) y rellena una fila `products` por organización existente. |
| `0009_units_of_measure` | Crea `units_of_measure`, siembra las 23 unidades de sistema por organización, asigna "Persona" a todo producto existente y deja `products.uom_id` `NOT NULL`. Otorga `unit_of_measure` a los roles que ya administran `product` y sube `role.version`. |
| `0010_product_fields` | Crea `product_categories`; agrega `products.category_id`, `sku`, `cost` y `min_quantity`; copia `app_settings.min_persons_per_line` a `products.min_quantity` y **elimina** esa columna; otorga `product_category` y `product_cost` a los roles correspondientes. |
| `0011_product_images` | Crea `product_images` (RLS con `FORCE`). |
| `0012_product_descriptions` | Renombra `products.description` a `short_description` (sin pérdida: el texto existente queda tal cual, es Markdown válido) y agrega `long_description` (nullable). Spec: `docs/superpowers/specs/2026-11-16-descripciones-producto-design.md`. |
| `0013_quote_line_units` | Agrega `quote_lines.uom_id` (`NOT NULL`, FK `RESTRICT` a `units_of_measure`, índice `(tenant_id, uom_id)`). Rellena cada línea existente con la unidad actual de su producto antes de exigir `NOT NULL`, así que ninguna cotización cambia. Spec: `docs/superpowers/specs/2026-11-16-unidad-por-linea-design.md`. |

Efecto para las organizaciones existentes: todo sigue funcionando con unidad "Persona" y tipo de catálogo `products`; el cotizador exige ahora el mínimo de cada producto en lugar del ajuste global.

### 9.2 Tipo de catálogo por organización

Con el rol `platform` (`DATABASE_PLATFORM_URL`):

```bash
pnpm --filter api tenant:set-catalog-kind --tenant <slug> --kind <products|services>
```

También se puede fijar al crear (`tenant:create --catalog-kind <kind>`). Un tipo desconocido falla con `TENANT_UNKNOWN_CATALOG_KIND`. La web lo toma en hasta 30 s.

### 9.3 `sharp` en el despliegue

- Las imágenes de producto se procesan con `sharp` (binario nativo, `--external:sharp` en el `build`). En el host/imagen de la API hay que ejecutar `pnpm install` **en la plataforma de destino**; no copiar un `node_modules` de otro sistema operativo o arquitectura.
- Si el binario falta, la API arranca y solo fallan las subidas de imágenes (carga dinámica).
- Las claves en R2 siguen el prefijo `t/{tenantId}/products/{productId}/{uuid}.webp` (y `…-thumb.webp`). El bucket y las credenciales de R2 son los mismos que usan los adjuntos de pagos.

### 9.4 Orden de despliegue y verificación

1. Backup con el dueño, como en la sección 3 (paso 1).
2. `db:migrate` (`0007`–`0013`) y **después** desplegar API y web de la misma versión: el código nuevo necesita `quantity`, `uom_id`, `tenant_profile`, `short_description`, `quote_lines.uom_id` y las tablas nuevas.
3. `mt:verify` con exit 0. Para esta fase comprueba cuatro tablas: `units_of_measure`, `product_categories` y `product_images` (RLS habilitado y forzado y política de aislamiento) y `tenant_profile` (RLS forzado y una sola política de lectura); además los enlaces `products.uom_id`, `quote_lines.uom_id`, `products.category_id` y `product_images.product_id`.
4. Fijar el tipo de catálogo donde corresponda (9.2).

### 9.5 Cambios de comportamiento a tener presentes

- El PDF de la cotización **ya no imprime las descripciones de ingredientes de las opciones**; cada grupo activo se muestra como un bloque normal.
- Solo en bases locales o de desarrollo: quien aplicó la `0010` anterior (antes de su versión final) debe correr `db:fresh`: el SQL de la `0010` cambió y esa base queda inconsistente con el journal.
- La cantidad mínima por línea es ahora un campo de cada producto (`min_quantity`); el ajuste `min_persons_per_line` ya no existe.
- Cada producto tiene descripción corta (≤ 500) y larga (≤ 10 000), guardadas como Markdown y editadas con texto enriquecido. La corta aparece también en la lista del catálogo, en texto plano y truncada. El PDF no cambia.
- Las descripciones se guardan como **Markdown** (la salida del editor es Markdown escapado: `&` → `&amp;`, `*` → `\*`…); todo consumidor de la API que las muestre debe renderizarlas como Markdown, no como texto plano ni HTML.
- La unidad de un producto ya no se bloquea al cotizarlo: cada línea de cotización guarda la unidad con la que se cotizó (`quote_lines.uom_id`). Una unidad usada por cualquier línea de cotización no se puede desactivar ni cambiar de tipo o equivalencia.

### 9.6 Reversión

No hay migraciones inversas. **Recomendado: restaurar el backup previo y desplegar la versión anterior de API y web.** La reversión manual no es trivial: `0010` elimina `app_settings.min_persons_per_line` y `0007` y `0012` renombran columnas que el código anterior usa; deshacerlas implica recrear la columna, devolver los nombres y borrar de `drizzle.__drizzle_migrations` las filas con `created_at` igual al `when` de cada migración en `apps/api/drizzle/meta/_journal.json`. Los archivos ya subidos a R2 bajo `t/{tenantId}/products/` quedan huérfanos si se descarta `product_images`. `0013` agrega `quote_lines.uom_id`: revertirla es quitar esa columna y la fila de su `when` en `drizzle.__drizzle_migrations`; tras eso el código anterior mostraría las líneas viejas en la unidad actual de cada producto.


---

## 10. Impuesto por línea y cargos adicionales (migraciones `0014`–`0015`)

Spec: `docs/superpowers/specs/2026-11-16-impuesto-por-linea-design.md`. Arquitectura: `docs/backend/architecture.md` §14.6 y §14.7. **Nada de esta sección se ejecuta contra producción sin la aprobación del dueño del proyecto.**

### 10.1 Qué hacen las migraciones

| Migración | Efecto |
| --- | --- |
| `0014_line_tax` | Impuesto por producto y por línea; elimina el impuesto por estado (`state_settings`) y el aviso de tasas. Los totales guardados no cambian. |
| `0015_extra_charges` | Crea `charge_types` y `quote_charges` (RLS con `FORCE`). Convierte la larga distancia y el recargo por tarjeta en cargos, activa el add-on `extraCharges` donde hubo cargos, otorga `charge_type` a los roles y **elimina** `quotes.long_distance_amount`, `quotes.apply_card_surcharge`, `quotes.card_surcharge_rate`, `quotes.card_surcharge_amount` y `app_settings.card_surcharge_rate`. |

Relleno de la `0015`, solo en las organizaciones con alguna cotización que usó cada cargo:

- Con alguna cotización con `long_distance_amount > 0`: tipo "Larga distancia" (fijo, valor por defecto 0) y, por cada una de esas cotizaciones, un `quote_charges` con el monto guardado como valor y como monto.
- Con alguna cotización con `apply_card_surcharge`: tipo "Recargo por tarjeta" (porcentaje, valor por defecto = `app_settings.card_surcharge_rate`, 0.09 si la organización no tiene fila de ajustes) y, por cada una de esas cotizaciones, un `quote_charges` con la tasa y el monto guardados.
- `extraCharges` se activa como fila permanente y sin precio (`tenant_features`, sin historial en `tenant_feature_events`, igual que la `0006`) solo en esas organizaciones. Las demás nacen sin el add-on y sin tipos de cargo.
- Permisos: los roles con `tax_rates.update` reciben `charge_type` `create`, `read`, `update` y `disable`; los roles con `quote.create` reciben `charge_type.read`. Solo los roles que ganaron un permiso suben `role.version`. Incluye roles propios de cada organización: revisarlos después de migrar.
- Ningún total guardado (`subtotal`, `tax_amount`, `total`, `deposit_amount`) se recalcula: el total de cada cotización sigue siendo total con impuesto + suma de sus `quote_charges`.

Relleno de la `0014`: `app_settings.default_tax_rate` toma la tasa de la cotización más reciente de la organización **con tasa mayor que 0** (0 si no tiene ninguna); cada producto toma esa tasa; cada línea toma la tasa de su cotización y una parte del impuesto ya guardado, por mayor residuo.

### 10.2 Orden de despliegue y verificación

1. Backup con el dueño, como en la sección 3 (paso 1). Guardar además, para comparar después, las tasas por estado y la tasa de la cotización más reciente de cada organización (la `0014` borra `state_settings` y `quotes.tax_rate`; sin esto solo el backup las conserva):

   ```sql
   SELECT tenant_id, state, tax_rate FROM state_settings ORDER BY tenant_id, state;
   SELECT DISTINCT ON (tenant_id) tenant_id, number, tax_rate, created_at
   FROM quotes ORDER BY tenant_id, created_at DESC, seq DESC;
   ```

2. **Detener la app** (API y jobs; web en mantenimiento), como en las secciones 3 y 5: el código anterior lee columnas que la `0014` y la `0015` eliminan y falla en cuanto se aplican.
3. `db:migrate` (`0014`–`0015`) y desplegar API y web de la misma versión **en el mismo paso**; recién entonces arrancar la app.
4. `mt:verify` con exit 0: comprueba RLS habilitado, forzado y con política de aislamiento en `charge_types` y `quote_charges`, y los enlaces `quote_charges.quote_id` y `quote_charges.charge_type_id`.
5. Revisar las tasas resultantes por organización y compararlas con lo guardado en el paso 1. Una organización que cobraba impuesto y quedó con `default_tax_rate` 0 (o con productos al 0%) debe corregirse antes de cotizar: tasa por defecto en Ajustes y tasa de cada producto.

   ```sql
   SELECT s.tenant_id, s.default_tax_rate,
          array_agg(DISTINCT p.tax_rate) AS product_rates,
          count(*) FILTER (WHERE p.tax_rate = 0 AND NOT p.tax_exempt) AS untaxed_products
   FROM app_settings s LEFT JOIN products p ON p.tenant_id = s.tenant_id
   GROUP BY s.tenant_id, s.default_tax_rate ORDER BY s.tenant_id;
   ```

   Con varias tasas por estado, la `0014` toma una sola (la de la última cotización con impuesto): los productos que deban cotizar con otra tasa se ajustan a mano.
6. Revisar con `feature:list --tenant <slug>` qué organizaciones recibieron `extraCharges`. Para darlo a otra: `feature:set --tenant <slug> --key extraCharges`.

### 10.3 Cambios de comportamiento a tener presentes

`0014` (impuesto por línea):

- El estado de la cotización ya no influye en el impuesto: cada producto tiene su tasa (o es exento) y cada línea guarda la tasa con la que se cotizó. La organización solo define la tasa por defecto con la que nace un producto.
- Ya no existe el aviso de tasas desactualizadas al abrir una cotización.
- El descuento de la cotización se limita al subtotal (antes podía dejar una base negativa).

`0015` (cargos adicionales):

- Sin `extraCharges` el catálogo de cargos se lee pero no se edita, y una cotización no puede recibir cargos nuevos ni cambiar los suyos; al editarla conserva los cargos que ya tenía y los recalcula sobre el total nuevo.
- Un tipo de cargo desactivado no se puede aplicar a una cotización nueva; las cotizaciones que ya lo tienen lo conservan.
- El recargo por tarjeta deja de ser un ajuste de la organización: su tasa es el valor por defecto del tipo de cargo.
- Los cargos migrados se llaman "Larga distancia" y "Recargo por tarjeta", y el PDF imprime el nombre tal como está guardado en cada cotización (antes imprimía "Long Distance Travel Fee" y "Card/Check Surcharge"). Son datos de la organización: el admin puede renombrar el tipo para las cotizaciones nuevas; las cotizaciones ya migradas conservan su copia del nombre.

**Editar una cotización migrada la recalcula con las reglas nuevas** (los totales guardados no cambian mientras nadie la edite):

- La larga distancia ya no paga impuesto (la `0014` había repartido ese impuesto entre las líneas): el impuesto y el total bajan.
- El recargo por porcentaje se calcula sobre el total con impuesto, sin incluir los cargos fijos.
- Un descuento mayor que el subtotal queda limitado al subtotal.
- Puede haber diferencias de centavos por el redondeo por tasa.

Avisar a soporte antes del despliegue.

### 10.4 Reversión

No hay migraciones inversas. **Recomendado: restaurar el backup previo y desplegar la versión anterior de API y web.** A mano, en orden inverso:

- `0015`: las columnas eliminadas pueden reconstruirse desde `quote_charges` (monto del cargo "Larga distancia"; tasa y monto del "Recargo por tarjeta") y `charge_types.default_value`, pero solo para los cargos migrados: los creados después no tienen equivalente en el esquema anterior. Recrear las columnas, rellenarlas, borrar `charge_types`, `quote_charges`, el tipo `charge_kind`, las filas `extraCharges` de `tenant_features` y los permisos `charge_type`.
- `0014`: recrear `state_settings` (con las filas guardadas en el paso 1 de 10.2), `app_settings.apply_tax_by_state` y `prompt_rate_changes`, `quotes.tax_rate` (la tasa de cualquiera de sus líneas, que la heredaron de la cotización; para una cotización con líneas a tasas distintas, creada después, no hay equivalente) y `quotes.declined_rates` (sin datos: el aviso vuelve a aparecer); luego quitar `app_settings.default_tax_rate`, `products.tax_rate`/`tax_exempt` y `quote_lines.tax_rate`/`tax_amount`.
- En ambos casos, borrar la fila de cada migración en `drizzle.__drizzle_migrations` (`created_at` = su `when` en `apps/api/drizzle/meta/_journal.json`).

## 11. Ubicación de operación (migración `0016`)

Spec: `docs/superpowers/specs/2026-11-16-ubicacion-operacion-design.md`. Arquitectura: `docs/backend/architecture.md` §14.8. **Nada de esta sección se ejecuta contra producción sin la aprobación del dueño del proyecto.**

### 11.1 Qué hace la migración

`0016_operating_location` crea `tenant_location` (una fila por organización, con `CHECK` que exige país, precisión y cobertura cuando `enabled`) y `tenant_location_areas` (RLS con `FORCE` en ambas), agrega `country`, `region` y `locality` a `quotes` y `events`, y **elimina** `state` y `city` de `quotes`, `events` y `clients` y el tipo enum `state`.

Conversión, antes de eliminar las columnas:

- Cada cotización y cada evento con `state` queda con `country = 'US'`, `region` = el código del estado (`NY`, `NJ`, `CT`) y `locality` = su `city` sin espacios sobrantes (nula si estaba vacía). `address` no cambia.
- Una cotización o evento **sin** `state` queda sin lugar: si tenía `city`, esa ciudad se pierde (una localidad sin región no es un lugar válido).
- Las ciudades se copian como texto, sin validar contra el dataset: una ciudad que no está en `@repo/geo` (p. ej. `Bronx`, `Brooklyn`) se sigue leyendo y se conserva al editar la cotización si se reenvía igual; para cambiarla hay que elegir una localidad del dataset.
- Las organizaciones con alguna cotización o evento con `state` quedan con la función **activa**: `country = 'US'`, `depth = 2`, `scope = 'country'`, `ask_address = true` (el flujo anterior). Las demás quedan sin fila (función apagada).
- `clients.state` y `clients.city` **se descartan** (el cliente conserva solo `address`).
- Permisos: los roles con `tax_rates.view` reciben `location_settings.view` y los que tienen `tax_rates.update` reciben `location_settings.update`. Solo los roles que ganaron un permiso suben `role.version`. Incluye roles propios de cada organización: revisarlos después de migrar.

### 11.2 Orden de despliegue y verificación

1. Backup con el dueño, como en la sección 3 (paso 1). Guardar además lo que la migración descarta, para poder consultarlo después:

   ```sql
   SELECT tenant_id, id, name, state, city FROM clients
   WHERE state IS NOT NULL OR city IS NOT NULL ORDER BY tenant_id, name;
   SELECT tenant_id, number, city FROM quotes WHERE state IS NULL AND city IS NOT NULL;
   SELECT tenant_id, id, city FROM events WHERE state IS NULL AND city IS NOT NULL;
   ```

2. **Detener la app** (API y jobs; web en mantenimiento): el código anterior lee `state`/`city`, que la `0016` elimina.
3. `db:migrate` (`0016`) y desplegar API y web de la misma versión **en el mismo paso**; recién entonces arrancar la app.
4. `mt:verify` con exit 0: comprueba RLS habilitado, forzado y con política en `tenant_location` y `tenant_location_areas`.
5. Revisar qué organizaciones quedaron activas y que cada lugar se copió:

   ```sql
   SELECT tenant_id, enabled, country, depth, scope, ask_address FROM tenant_location;
   SELECT tenant_id, region, count(*) FROM quotes GROUP BY tenant_id, region ORDER BY 1, 2;
   ```

6. Cada organización activada puede ajustar en Ajustes la precisión, la cobertura o si pide dirección.

### 11.3 Cambios de comportamiento a tener presentes

- El país de una cotización lo fija el servidor desde la configuración; el cliente solo envía `region` y `locality`, validadas contra el dataset y la cobertura.
- Con la función activa, una cotización que no es borrador exige los niveles configurados y la dirección si `ask_address`; para salir de borrador (pasar a "Cotizada") se aplica la misma regla más al menos una línea. Con la función apagada solo se exige una línea (antes se exigían estado, ciudad y dirección).
- Con la función apagada la cotización no cambia su lugar ni su dirección guardados, aunque la petición los traiga.
- El evento copia país, región, localidad y dirección de la cotización al aprobarla.
- El PDF muestra dirección, localidad y nombre de la región (`New York` en lugar de `NY`).
- Bajar la precisión (`depth`) no borra nada al instante: la cotización conserva su localidad y se sigue mostrando, pero al guardarla de nuevo el servidor descarta los niveles más profundos que la precisión vigente.
- Una cotización creada con la función apagada no tiene país; con la función activa a precisión 0 se considera completa y el primer guardado le fija el país configurado.
- Los códigos de región se repiten entre países (`CA`, `CO`, `MD`, `MN`, `MS`, `MT`, `RI` existen en `US` y `NI`): el filtro por región se limita al país configurado, y un lugar guardado bajo otro país no se reenvía desde el cotizador (se descarta al guardar salvo que el usuario elija el nuevo).

### 11.4 Reversión

No hay migración inversa. **Recomendado: restaurar el backup previo y desplegar la versión anterior de API y web.** A mano: recrear el tipo `state` (`NY`, `NJ`, `CT`) y las columnas `state`/`city` en `quotes`, `events` y `clients`; rellenar `quotes`/`events` con `state = region::state`, `city = locality` donde `country = 'US'` y `region IN ('NY','NJ','CT')` (otras regiones o países no tienen equivalente); los clientes solo recuperan sus datos desde lo guardado en el paso 1 de 11.2. Luego borrar `country`, `region` y `locality`, las tablas `tenant_location_areas` y `tenant_location`, los permisos `location_settings` y la fila de la migración en `drizzle.__drizzle_migrations` (`created_at` = su `when` en `apps/api/drizzle/meta/_journal.json`).
