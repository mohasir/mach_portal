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
- **Relleno de las organizaciones existentes:** inserta, para cada `organization`, 5 filas **permanentes** (`expires_at` `NULL`) y sin precio: `quotes`, `events`, `notifications`, `priceTiers` y `configurableOptions`. Así no se quita funcionalidad a nadie. El relleno corre antes del `FORCE`, porque después el propio dueño que migra quedaría sujeto a la política de solo lectura.

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

