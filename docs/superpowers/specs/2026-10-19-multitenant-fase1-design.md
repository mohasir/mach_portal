# Multi-tenant — Fase 1: núcleo de tenancy

Fecha: 2026-10-19 · Revisado: dominio único con tenant en la sesión · Rama: `multitenant` (desde `main`) · Estado: borrador para revisión

## 1. Contexto y objetivo

Mach Portal hoy es single-tenant y está en producción con un cliente. El objetivo del programa
multi-tenant es ofrecerlo como SaaS a más clientes, todos bajo **un único dominio**, con datos
completamente aislados. El producto conserva su propia marca en todas partes; la marca de cada
cliente solo se usa dentro del sistema, una vez iniciada la sesión.

Esta fase entrega el **núcleo de tenancy**: modelo de organizaciones, `tenant_id` en los datos,
resolución del tenant desde la sesión, autenticación con membresías, aislamiento de datos por
filtros explícitos y la migración del cliente actual como tenant #1. No sube a producción hasta que
todas las fases del programa (incluida la 1b, RLS) estén completas y probadas en `staging-mt`.

### Decisiones ya tomadas (programa completo)

| Tema | Decisión |
|---|---|
| Modelo | Una sola instalación y un único dominio; `tenant_id` en la base de datos; el tenant de cada petición es la organización activa de la sesión |
| Identidad | Plugin `organization` de Better Auth, usuario global con membresías |
| Mismo email en varios tenants | Sí: es el mismo usuario con varias membresías (caso raro; ver selección de organización) |
| Acceso sin organización | No se permite: el login se rechaza si la persona no pertenece a ninguna organización (excepto el admin de plataforma) |
| Aislamiento | `WHERE tenant_id` explícito en todas las consultas (fase 1) + RLS de Postgres como segunda barrera (fase 1b, obligatoria antes de producción) |
| Branding | Tabla `tenant_branding` (fase 3), usada solo dentro del sistema tras el login; login, PWA y correos de acceso llevan la marca del producto |
| Roles y permisos | Roles y matriz rol→permisos en BD, globales, editables desde el portal; `organization_id` nullable para soportar roles por tenant después (fase 2). El catálogo de permisos sigue en código |
| Planes y feature flags | Planes con features, módulos como atajo, overrides por tenant; cobro manual (fase 4) |
| Admin de plataforma | `user.isPlatformAdmin`; puede seleccionar cualquier organización y actúa con permisos totales viendo una a la vez; panel en la ruta `/platform` de la misma app (fase 4) |
| Slug de la organización | Identificador estable de la organización; ya no es un subdominio |
| Crons y jobs | Desactivados durante el desarrollo multi-tenant |
| Offboarding | Post-MVP multi-tenant |

### Fases del programa

1. **Núcleo de tenancy** (este documento).
1b. **RLS** como segunda barrera de aislamiento (spec propio; ver sección 6).
2. RBAC en base de datos.
3. Branding (`tenant_branding` dentro del sistema, PDFs con el otro servicio, emails).
4. Planes, feature flags y panel de plataforma.

Cada fase tiene su propio spec, plan e implementación, y deja el sistema funcionando. Producción
solo se actualiza cuando todas estén completas y probadas.

## 2. Alcance de la fase 1

**Incluye:** `organization`/`member`, `tenant_id` en tablas de negocio, tenant desde la sesión con
selección de organización, login con rechazo si no hay organización, aislamiento por `WHERE`
explícito, numeración de cotizaciones por tenant, función `createTenant`, migración del tenant #1,
entorno `staging-mt` y suites de regresión y aislamiento.

**No incluye:** RLS, roles de BD adicionales, transacción por request (fase 1b); roles en BD
(la autorización sigue leyendo `user.role` con el plugin `admin`, fase 2); branding; planes;
panel de plataforma; impersonación; dominios propios por cliente; offboarding; cron jobs; claves
foráneas compuestas.

## 3. Modelo de datos

### Better Auth

- Plugin `organization` (sin `teams` ni `dynamicAccessControl`): tablas `organization`, `member`,
  `invitation` (esta última sin uso, el plugin la exige) y `session.activeOrganizationId`.
- `organization.slug` es el identificador estable y único de la organización (formato
  `^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$`). Es inmutable una vez creado. Ya no es un subdominio,
  así que no hay lista de slugs reservados.
- Se elimina `organization.customDomain` (con un solo dominio no tiene uso).
- `user.isPlatformAdmin` (boolean, default false). En la migración lo reciben las cuentas de
  `mt.platform_admin_emails` o, sin esa lista, todos los `superadmin` actuales.
- En esta fase `member.role` guarda el mismo valor que `user.role` y no se consulta para autorizar.

### `tenant_id` en tablas de negocio

- Tablas: clientes, eventos y sus hijas (pagos, adjuntos, selecciones, asignaciones de staff,
  reprogramaciones), cotizaciones y líneas, catálogo y precios, tipos de evento, motivos de
  reprogramación, staff, plantillas, notificaciones y preferencias de usuario.
- Tipo `text`, FK a `organization.id`, `NOT NULL`, indexado, sin valor por defecto. Las hijas
  también lo llevan (denormalizado): simplifica los filtros y deja el esquema listo para las
  políticas de RLS de la fase 1b.
- `userPreferences` lleva `tenant_id`: un usuario global tiene preferencias por cliente.
- Las tablas de auth (`user`, `session`, `account`, `verification`) siguen globales.
  `organization` y `member` tampoco llevan `tenant_id`.

### Unicidad y claves

- `name` de `eventTypes`, `catalog` y `rescheduleReasons`: único por `(tenant_id, name)`.
- `quotes.seq` y `quotes.number`: únicos por `(tenant_id, seq)` y `(tenant_id, number)`.
- `app_settings`: la clave primaria pasa a ser `tenant_id` (deja de ser singleton `id = 1`).
- `state_settings`: clave primaria `(tenant_id, state)`.

### Numeración de cotizaciones

El cálculo `max(seq) + 1` pasa a ser por tenant y se protege con `pg_advisory_xact_lock` por
tenant dentro de la transacción de creación (que ya existe), lo que corrige la condición de
carrera actual.

## 4. Resolución del tenant y autenticación

**Principio:** el tenant de una petición es la **organización activa de la sesión**
(`session.activeOrganizationId`); la autorización real es sesión + membresía, **re-verificada en
cada petición**. Nada que llegue en la URL, en el cuerpo o en cabeceras elige el tenant.

### Resolución

- `createContext` obtiene la sesión (sin caché de cookie, para que un cambio de organización
  surta efecto al instante). Si trae `activeOrganizationId`, carga la organización por id (caché
  en memoria ~60 s) y expone `ctx.tenant`; si no, `ctx.tenant` es `null`.
- No hay `APP_BASE_DOMAIN`, host reenviado ni cabecera interna entre web y API: la web
  hace proxy a la API como hoy, sin lógica de tenant.

### Cadena de procedures (tRPC)

```text
createContext      → sesión → organización activa → ctx.tenant (o null)
authedProcedure    → exige sesión (para tenant.memberships y tenant.select)
tenantProcedure    → exige sesión y ctx.tenant (si no hay organización activa: TENANT_NOT_SELECTED)
protectedProcedure → además exige membresía (o isPlatformAdmin) y mustChangePassword resuelto;
                     deja ctx.tenantId
guardedProcedure   → permisos del rol (como hoy)
```

El `tenantId` **nunca** viene del cliente ni del `input`.

### Rutas de Express fuera de tRPC

`server.ts` expone, además de `/trpc`, la ruta de adjuntos `/api/uploads/event-payments`
(`events.express.ts`, carga multipart) y `/api/auth/*` (Better Auth). La ruta de adjuntos no pasa
por los procedures, así que usa un middleware de Express compartido (`guardTenantSession`) que
aplica las mismas reglas: tenant de la sesión, membresía o admin de plataforma, auditoría y
permisos, y deja `tenantId` a disposición del handler. Cualquier ruta nueva fuera de tRPC debe
usarlo. La decisión de acceso (miembro o admin de plataforma) vive en una sola función
compartida por tRPC y Express.

### Login y selección de organización

- El login es global (email y contraseña). Un gancho al crear la sesión determina la organización
  activa a partir de las membresías de la persona:
  - **Una organización:** se activa automáticamente.
  - **Ninguna:** se rechaza el login con un error específico (`USER_NO_ORGANIZATION`); la persona ya
    probó sus credenciales, así que no se filtra información. El admin de plataforma sin
    membresías sí entra (sin organización activa hasta que elija una).
  - **Varias (caso raro):** la sesión se crea sin organización activa y la web muestra una pantalla
    para elegir.
- Dos procedimientos tRPC propios, sin pasar por los endpoints del plugin (que siguen bloqueados
  por HTTP):
  - `tenant.memberships`: lista las organizaciones de quien consulta (`id`, `slug`, `name`).
  - `tenant.select({ organizationId })`: comprueba la membresía (o `isPlatformAdmin`) y actualiza
    `session.activeOrganizationId`. Es también la forma de cambiar de organización durante la sesión.
- `trustedOrigins` y el CORS de la API vuelven a una lista fija de orígenes (`WEB_ORIGIN`).
- Cookie de sesión de host único (sin `Domain`), `crossSubDomainCookies` apagado.
- Los enlaces de restablecer contraseña y de notificaciones usan `WEB_APP_URL`.
- Superficie HTTP de Better Auth: el registro público (`/sign-up/email`) y los endpoints de los
  plugins `organization` y `admin` están bloqueados por HTTP; las llamadas internas del servidor
  (`auth.api.*`) siguen funcionando.

### Admin de plataforma

- Puede seleccionar cualquier organización (`tenant.select`) y entra con permisos totales
  (equivalente al `superadmin` actual) si no es miembro; ve una organización a la vez: todas las
  consultas siguen filtradas por la organización activa de la sesión.
- El acceso sin membresía queda en un log de auditoría y la UI muestra un aviso de
  "modo plataforma": cada escritura deja una fila; las lecturas dejan una fila por sesión y
  organización (las lecturas repetidas dentro de esa ventana se registran una sola vez; la marca
  vive en memoria del proceso, así que un reinicio o varias instancias pueden sumar alguna fila).
- El panel es de la fase 4 (ruta `/platform`; hasta entonces, alta por script).

## 5. Aislamiento de datos

### `WHERE tenant_id` explícito

Toda consulta (lecturas, `update`, `delete`, subconsultas y joins) filtra por tenant mediante un
helper `tenantEq(tabla, tenantId)`. Los `INSERT` reciben `tenantId` explícito.

### Inyección del tenant

Cada módulo deja de crear su servicio una sola vez con la conexión global
(`new XService(new XRepository(db))`) y pasa a una fábrica por request:

```ts
export const clientsModule = (ctx: TenantCtx) =>
  new ClientsService(new ClientsRepository(db, ctx.tenantId));
```

Los repositorios reciben `(db, tenantId)` y el tenant es obligatorio en el constructor, por lo
que un repositorio sin tenant no compila. Jobs y scripts pasan el `tenantId` explícito. Es un
cambio mecánico en 14 módulos.

### Salvaguardas

- Constructor que exige `tenantId` (verificado por el compilador).
- Suite de aislamiento obligatoria en CI (sección 8): con dos tenants cargados, cada método de
  cada repositorio debe fallar si olvida el filtro.
- Regla para claves foráneas: Postgres no valida el tenant al comprobar una FK, así que un
  `INSERT` podría apuntar a una fila de otro tenant si se le pasa un id ajeno. Todo id recibido
  por `input` se resuelve con una lectura del repositorio (filtrada por tenant) antes de
  insertarlo; se revisa módulo por módulo en el plan. Las FK compuestas `(tenant_id, id)` quedan
  fuera de esta fase.

## 6. Fase 1b (spec propio): RLS como segunda barrera

Obligatoria antes de producción. La fase 1 deja el terreno listo (`tenant_id` en todas las
tablas, repositorios con tenant explícito). El alcance de la 1b, a detallar en su propio spec:

- Roles de BD: `owner` (migraciones), `app` (la API; sin `SUPERUSER` ni `BYPASSRLS`) y
  `platform` (`BYPASSRLS`; scripts y panel). Dos pools de conexión; verificación al arrancar de
  que el rol de la API no puede saltarse el RLS.
- Políticas por tabla con `tenant_id` (`ENABLE` y `FORCE ROW LEVEL SECURITY`,
  `tenant_id = current_setting('app.tenant_id', true)`), declaradas con `pgPolicy`.
- Transacción por request que fija `app.tenant_id` con `set_config(..., true)`.
- Riesgo de conexión retenida: las operaciones con una llamada externa lenta en medio
  (`generatePdf` con el servicio de PDF, `addPaymentAttachment` con la subida a R2) usarán
  transacciones cortas (`withTenantTx`) con borrado del archivo subido si falla el guardado.
- Configuración y dimensionado del pool (`DB_POOL_MAX`, límite de conexiones del plan de
  Postgres), prueba de carga en `staging-mt` y pgBouncer como plan B.
- Pruebas de RLS con el rol `app` (consulta sin filtro, sin tenant fijado, `INSERT` ajeno).

## 7. Entornos, migración y despliegue

### Ramas y entornos

- Rama de integración `multitenant` (no se borra al mergear fases). Cada fase en su rama con PR
  hacia `multitenant`. `main` se fusiona a `multitenant` con frecuencia.
- Entorno `staging-mt` separado del staging actual: servicios propios, base de datos restaurada
  desde un snapshot de prod con acceso restringido, **bucket y credenciales de R2 propios**,
  correo desactivado o redirigido a un buzón de prueba, crons desactivados y su propio dominio
  (un único host, sin wildcard).
- Producción no se toca hasta completar todas las fases.

### Migración del tenant #1

1. **Esquema aditivo:** tablas del plugin, `session.activeOrganizationId`, `user.isPlatformAdmin`
   y `tenant_id` nullable en las tablas de negocio.
2. **Datos:** crea la organización (slug y nombre por parámetro), un `member` por cada usuario
   con su rol actual, `isPlatformAdmin` para las cuentas de la lista explícita
   `mt.platform_admin_emails` (o, si no se pasa, para todos los `superadmin`), rellena `tenant_id` en todas las
   filas, convierte `app_settings` singleton en la fila del tenant y rellena
   `activeOrganizationId` en las sesiones abiertas para no desconectar a nadie.
3. **Endurecimiento:** `NOT NULL`, FK e índices, unicidades compuestas y cambio de claves primarias.

Los archivos de R2 y las URLs de PDFs guardadas no se tocan.

### Ensayos, cutover y reversión

- Mínimo dos ensayos completos sobre un snapshot de prod, con tiempos medidos; el último sigue
  el runbook tal cual.
- Script de verificación (antes/después): conteo por tabla, ninguna fila sin `tenant_id`, sin
  huérfanas ni duplicados, un `member` por usuario.
- Cutover: backup previo, ventana de mantenimiento con escrituras bloqueadas, migración,
  verificación, smoke tests y apertura.
- Sin migración inversa: la reversión es restaurar el backup y desplegar la versión anterior,
  perdiendo lo escrito después del cutover. Se define una ventana corta de decisión con criterios claros.

## 8. Pruebas

- **Regresión:** la suite actual de Vitest (api y web) en verde, adaptada al contexto con tenant;
  checklist manual de los flujos principales sobre `staging-mt` (basado en
  `docs/mach-bar-flows.md`), ejecutado por el usuario.
- **Aislamiento (Postgres real, no mocks):** con dos tenants, cada método de cada repositorio no
  lee ni modifica datos del otro; por cada relación entre tablas, un test que intenta insertar
  con un id del otro tenant y espera rechazo.
- **Auth y tenant de la sesión:** sesión sin organización activa → `TENANT_NOT_SELECTED`;
  `activeOrganizationId` de una organización donde ya no es miembro → rechazo (membresía
  re-verificada en cada petición); login de una persona sin organizaciones → rechazado con
  `USER_NO_ORGANIZATION`; con una organización → activa automáticamente; con varias → sin
  organización activa hasta `tenant.select`; `tenant.select` con una organización ajena → rechazo;
  el admin de plataforma puede seleccionar cualquiera y queda auditado; un cambio de organización
  surte efecto en la petición siguiente; orígenes no listados rechazados por CORS.
- **Superficie de Better Auth:** registro público y endpoints de `organization` y `admin` bloqueados
  por HTTP (también para un administrador); `auth.api.signUpEmail` interno sigue funcionando.
- **Rutas de Express:** la subida de adjuntos sin sesión, con una organización activa distinta o sin
  membresía es rechazada, igual que en tRPC.
- **Numeración de cotizaciones:** prueba de concurrencia.
- **Migración:** el script de verificación corre en las pruebas automáticas sobre un dataset de ejemplo.

## 9. Criterio de fase terminada

Suites de regresión y aislamiento en verde, dos ensayos de migración limpios, checklist manual
aprobado en `staging-mt`, `pnpm check-types` sin errores.

## 10. Pendientes abiertos (no bloquean el desarrollo)

- Dominio único de producción y de `staging-mt` (hoy se dispone de `oravitech.com` en Cloudflare;
  con un solo host sirve el certificado gratuito, p. ej. `portal.oravitech.com`). Se decide antes
  del cutover.
- URL con la que el cliente actual seguirá entrando tras el cutover.
- Textos i18n (es/en) de los errores `TENANT_NOT_SELECTED`, `USER_NO_ORGANIZATION` y
  `INVALID_EMAIL_OR_PASSWORD`, y de la pantalla de selección de organización.
