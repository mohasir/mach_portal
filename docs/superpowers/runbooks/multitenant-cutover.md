# Runbook — Cutover multi-tenant (fase 1)

Convierte la base actual (un solo cliente, creada con `drizzle-kit push`) en el tenant #1 de la instalación multi-tenant. Spec: `docs/superpowers/specs/2026-10-19-multitenant-fase1-design.md` (§7). Todos los comandos se ejecutan desde la raíz del repo con `DATABASE_URL` apuntando a la base objetivo.

> **No subir a producción hasta completar todas las fases** (incluida la 1b, RLS). Este runbook se usa primero en los ensayos sobre `staging-mt` y solo después en producción.

## 0. Decisiones y acciones previas (antes de la ventana)

- [ ] **Rotar la contraseña de `samuel@admin.com`** si todavía es la del seed por defecto: la migración la convierte en administrador de plataforma.
- [ ] **Decisión pendiente: restablecer o no las filas globales de `quote_stages` a los valores por defecto del seed.** La migración copia las personalizaciones actuales (label, color, description) de cada etapa al overlay `quote_stage_settings` del tenant #1 y **no toca** las filas globales. Si se quiere que los tenants nuevos partan de los valores por defecto del producto y no de las personalizaciones del cliente actual, hay que restablecer esas filas globales **después** del cutover y de `mt:verify`. Ojo: `db:seed` (`seeds/quoteStages.ts`) solo inserta etapas que faltan y **no sobrescribe** las existentes, así que el restablecimiento requiere un `UPDATE` manual revisado con los valores de `quoteStages.ts`. Nunca antes de que la migración copie el overlay.
- [ ] Definir el **host único** de cada entorno (hoy `oravitech.com` en Cloudflare; p. ej. `portal.oravitech.com`) y la URL con la que el cliente actual seguirá entrando.
- [ ] Verificar que `DATABASE_URL` del cutover es una **conexión directa** a Postgres (no pooler), ver paso 5.
- [ ] Verificar el límite de intentos de login (sección 5).
- [ ] Avisar la ventana de mantenimiento al cliente.

## 1. Entornos y variables

Valores por servicio (no hay comodines ni dominios por cliente: **un único host**):

| Servicio | Variable | Valor |
| --- | --- | --- |
| API | `DATABASE_URL` | Conexión directa a Postgres (no pooler) |
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
- **Crons desactivados.** En esta fase `server.ts` no programa crons (los jobs son por tenant y nada itera sobre tenants): no hay recordatorios automáticos. Cuando se necesiten, correr `pnpm --filter api jobs:event-reminders --tenant=<slug>` a mano.
- `WEB_ORIGIN` y `WEB_APP_URL` con el host de staging-mt.

## 2. Ensayos (mínimo dos, con snapshot de producción)

Repetir las secciones 3 y 4 completas sobre un **snapshot restaurado de producción** en `staging-mt`; el último ensayo se hace siguiendo este runbook tal cual. Registrar los tiempos de cada paso (backup, `mt:verify --pre`, migración, `mt:verify`).

Comprobación adicional obligatoria en el primer ensayo (**esquema real de producción vs. 0000**): antes de `db:baseline`, comparar el esquema del snapshot restaurado contra el de una base nueva creada con la migración `0000` (en una base descartable: `pnpm --filter api db:reset` —destruye el esquema `public`— y ejecutar el SQL de `apps/api/drizzle/0000_baseline.sql` con `psql`; o `pg_dump --schema-only` de ambas y `diff`). Deben coincidir en columnas, constraints (nombres incluidos) e índices. La migración `0001` elimina por nombre exacto 6 uniques y 3 claves primarias; si el nombre real en producción difiere, la migración aborta (sin efecto, es transaccional) y hay que corregir antes del cutover. `mt:verify --pre` ya comprueba la existencia de esos nombres, pero la comparación completa detecta además diferencias de columnas o defaults.

Cada ensayo debe terminar con el checklist de regresión (`multitenant-regression-checklist.md`) ejecutado sobre la base migrada.

## 3. Cutover

Ventana de mantenimiento con **escrituras bloqueadas** (web en modo mantenimiento o API detenida).

1. **Backup** y prueba de restauración:
   ```bash
   pg_dump --format=custom --no-owner "$DATABASE_URL" -f mach_pre_mt_$(date +%Y%m%d%H%M).dump
   ```
   Restaurar el dump en una base de prueba y comprobar que abre. Sin backup restaurable no se continúa.
2. **Pre-verificación** (solo `SELECT`; conservar la salida). Debe terminar con exit 0:
   ```bash
   pnpm --filter api mt:verify --pre > verify-pre.txt
   ```
   Comprueba que existen las 9 constraints que la migración elimina, que `app_settings` no tiene filas distintas de `id = 1`, duplicados contra las futuras claves por tenant, y avisa de roles tipo `super admin` que no sean exactamente `superadmin` (esos usuarios no serían administradores de plataforma).

   **Revisar la lista `superadmins:`** que imprime. Un administrador de plataforma puede seleccionar **cualquier** organización, así que el personal `superadmin` del cliente **no** debe recibir ese flag (siguen siendo `superadmin` dentro de su propio tenant). Elegir solo las cuentas del equipo de plataforma y comprobar la lista (case-insensitive, separada por comas; falla si un email no existe):
   ```bash
   pnpm --filter api mt:verify --pre --platform-admin-emails=<a@x,b@y> >> verify-pre.txt
   ```
   La línea `platform admins after 0001 (from the list): …` debe mostrar exactamente esas cuentas. Sin lista, `0001` promueve a **todos** los `superadmin` (solo aceptable si todos son del equipo de plataforma).
3. **`db:baseline`, una sola vez por base creada con `push`** (producción y el staging actual no tienen filas en `drizzle.__drizzle_migrations`). Registra la migración `0000` como aplicada; se niega a correr si ya está registrada:
   ```bash
   pnpm --filter api db:baseline
   ```
4. **Conexión directa.** `DATABASE_URL` debe apuntar **directo a Postgres**, no a un pooler (PgBouncer en modo transacción, endpoints pooled de Neon/Supabase). Los parámetros `--set` viajan en el parámetro de arranque `options`, que los poolers rechazan o descartan en silencio; si se descarta, la migración falla con "needs the tenant #1 slug" aunque se haya pasado `--set`.
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
- Restaurar: `pg_restore --clean --if-exists -d "$DATABASE_URL" <dump>`.

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
