# Multi-tenant — Fase 1: núcleo de tenancy

Fecha: 2026-10-19 · Rama: `multitenant` (desde `main`) · Estado: borrador para revisión

## 1. Contexto y objetivo

Mach Portal hoy es single-tenant y está en producción con un cliente. El objetivo del programa
multi-tenant es ofrecerlo como SaaS a más clientes, cada uno en su propio subdominio, con datos
completamente aislados.

Esta fase entrega el **núcleo de tenancy**: modelo de organizaciones, `tenant_id` en los datos,
resolución del tenant por host, autenticación con membresías, aislamiento de datos por filtros
explícitos y la migración del cliente actual como tenant #1. No sube a producción hasta que todas
las fases del programa (incluida la 1b, RLS) estén completas y probadas en `staging-mt`.

### Decisiones ya tomadas (programa completo)

| Tema | Decisión |
|---|---|
| Modelo | Una sola instalación, `tenant_id` en la base de datos, un subdominio por cliente |
| Identidad | Plugin `organization` de Better Auth, usuario global con membresías |
| Mismo email en varios tenants | Sí: es el mismo usuario con varias membresías |
| Aislamiento | `WHERE tenant_id` explícito en todas las consultas (fase 1) + RLS de Postgres como segunda barrera (fase 1b, obligatoria antes de producción) |
| Branding | Tabla `tenant_branding` (fase 3) |
| Roles y permisos | Roles y matriz rol→permisos en BD, globales, editables desde el portal; `organization_id` nullable para soportar roles por tenant después (fase 2). El catálogo de permisos sigue en código |
| Planes y feature flags | Planes con features, módulos como atajo, overrides por tenant; cobro manual (fase 4) |
| Admin de plataforma | `user.isPlatformAdmin`; entra a cualquier tenant con permisos totales viendo un tenant a la vez; panel en `admin.<dominio>` (fase 4) |
| Crons y jobs | Desactivados durante el desarrollo multi-tenant |
| Offboarding | Post-MVP multi-tenant |

### Fases del programa

1. **Núcleo de tenancy** (este documento).
1b. **RLS** como segunda barrera de aislamiento (spec propio; ver sección 6).
2. RBAC en base de datos.
3. Branding (`tenant_branding`, PDFs con el otro servicio, PWA dinámico, emails).
4. Planes, feature flags y panel de plataforma.

Cada fase tiene su propio spec, plan e implementación, y deja el sistema funcionando. Producción
solo se actualiza cuando todas estén completas y probadas.

## 2. Alcance de la fase 1

**Incluye:** `organization`/`member`, `tenant_id` en tablas de negocio, resolución por host,
login con verificación de membresía, aislamiento por `WHERE` explícito, numeración de
cotizaciones por tenant, función `createTenant`, migración del tenant #1, entorno `staging-mt`
y suites de regresión y aislamiento.

**No incluye:** RLS, roles de BD adicionales, transacción por request (fase 1b); roles en BD
(la autorización sigue leyendo `user.role` con el plugin `admin`, fase 2); branding; planes;
panel de plataforma; impersonación; dominios propios; offboarding; cron jobs; claves foráneas
compuestas.

## 3. Modelo de datos

### Better Auth

- Plugin `organization` (sin `teams` ni `dynamicAccessControl`): tablas `organization`, `member`,
  `invitation` (esta última sin uso, el plugin la exige) y `session.activeOrganizationId`.
- `organization.slug` es el subdominio. Es inmutable una vez creado. Slugs reservados
  (`admin`, `www`, `api`, `app`, `staging`, …) se rechazan al crear.
- `organization.customDomain` nullable, sin uso en esta fase. Reservado para dominios propios.
- `user.isPlatformAdmin` (boolean, default false). Los `superadmin` actuales lo reciben en la migración.
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
  `organization` y `member` tampoco llevan `tenant_id` (se consultan antes de conocer el tenant).

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

**Principio:** el host solo *selecciona* el tenant. La autorización real es sesión + membresía.

### Resolución

- Variable `APP_BASE_DOMAIN`. En desarrollo: `cliente.localhost:3000`.
- El host se parte en `slug.<base>`; slug desconocido o reservado → página 404 de organización
  no encontrada.
- La API toma el host reenviado por el proxy de Next (`x-forwarded-host`).
  **A verificar:** que los `rewrites` de `apps/web/next.config.ts` lo propaguen; si no, el
  middleware lo inyecta como header.
- `createContext` busca la organización por slug (caché en memoria ~60 s) y expone `ctx.tenant`.
  `middleware.ts` solo reenvía el host; no consulta la BD (corre en el edge).
- Endurecimiento: Next añade un header interno con secreto compartido (`x-internal-key`) y la
  API solo acepta el host reenviado cuando ese secreto es válido. Si hay red privada entre
  servicios, se bloquea además el acceso público directo a la API.

### Cadena de procedures (tRPC)

```text
createContext      → host → organización → ctx.tenant (o 404)
tenantProcedure    → exige ctx.tenant
protectedProcedure → exige sesión + membresía (o isPlatformAdmin) + activeOrganizationId == ctx.tenant;
                     deja ctx.tenantId
guardedProcedure   → permisos del rol (como hoy)
```

El `tenantId` **nunca** viene del cliente ni del `input`.

### Rutas de Express fuera de tRPC

`server.ts` expone, además de `/trpc`, la ruta de adjuntos `/api/uploads/event-payments`
(`events.express.ts`, carga multipart) y `/api/auth/*` (Better Auth). La ruta de adjuntos no pasa
por los procedures, así que necesita un middleware de Express compartido que aplique la misma
resolución de tenant, sesión y membresía y deje `tenantId` a disposición del handler. Cualquier
ruta nueva fuera de tRPC debe usarlo. `/api/auth/*` resuelve el tenant desde el host y aplica el
hook de membresía descrito abajo.

### Login y sesión

- Hook posterior al login: si el usuario no es miembro del tenant del host (y no es admin de
  plataforma), responde el mismo error genérico de credenciales inválidas.
- `session.activeOrganizationId` se fija desde el host.
- Cookies solo de host (sin `Domain`), `crossSubDomainCookies` apagado: cada tenant tiene sesión
  aislada; quien use dos clientes inicia sesión en cada uno.
- `baseURL` y `trustedOrigins` dejan de ser fijos. **A verificar:** si Better Auth 1.6 admite
  hosts permitidos dinámicos o basta un patrón `https://*.<APP_BASE_DOMAIN>`. El CORS de la API
  (`WEB_ORIGIN`) pasa a una función que acepta solo subdominios existentes de la base.
- Los enlaces de restablecer contraseña y de notificaciones se construyen con el host del
  tenant, no con `WEB_APP_URL`.

### Admin de plataforma

- Puede entrar a cualquier tenant con permisos totales (equivalente al `superadmin` actual) y
  ve un tenant a la vez: todas las consultas siguen filtradas por el tenant de la sesión.
- Todo acceso y escritura queda en un log de auditoría y la UI muestra un aviso de "modo plataforma".
- `admin.<dominio>` queda reservado; el panel es de la fase 4 (hasta entonces, alta por script).

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
- Suite de aislamiento obligatoria en CI (sección 7): con dos tenants cargados, cada método de
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
  correo desactivado o redirigido a un buzón de prueba, crons desactivados y dominio wildcard propio.
- Producción no se toca hasta completar todas las fases.

### Migración del tenant #1

1. **Esquema aditivo:** tablas del plugin, `session.activeOrganizationId`, `user.isPlatformAdmin`
   y `tenant_id` nullable en las tablas de negocio.
2. **Datos:** crea la organización (slug y nombre por parámetro), un `member` por cada usuario
   con su rol actual, `isPlatformAdmin` para los `superadmin`, rellena `tenant_id` en todas las
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
- **Auth y host:** host de otro tenant con sesión propia → 403; `activeOrganizationId` distinto →
  rechazo; orígenes parecidos (`<base>.evil.com`, `evil-<base>`) rechazados por CORS y
  `trustedOrigins`; slug inexistente o reservado → 404; llamada directa a la API sin el header
  interno → el host reenviado se ignora.
- **Rutas de Express:** la subida de adjuntos sin sesión, con sesión de otro tenant o con host de
  otro tenant es rechazada, igual que en tRPC.
- **Numeración de cotizaciones:** prueba de concurrencia.
- **Migración:** el script de verificación corre en las pruebas automáticas sobre un dataset de ejemplo.

## 9. Criterio de fase terminada

Suites de regresión y aislamiento en verde, dos ensayos de migración limpios, checklist manual
aprobado en `staging-mt`, `pnpm check-types` sin errores.

## 10. Pendientes abiertos (no bloquean el desarrollo)

- Dominio base de producción y de `staging-mt`. Hoy se dispone de `oravitech.com` en Cloudflare;
  el wildcard de segundo nivel no lo cubre el certificado gratuito de Cloudflare. Se decide
  antes del cutover; todo depende de `APP_BASE_DOMAIN`.
- Subdominio del cliente actual (y mantener el actual como alias).
- Verificaciones técnicas marcadas como "A verificar" en la sección 4.
