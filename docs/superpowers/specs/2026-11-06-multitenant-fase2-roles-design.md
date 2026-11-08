# Multi-tenant — Fase 2: roles y permisos en base de datos

Fecha: 2026-11-06 · Rama: `feat/mt-fase-2-roles` (desde `multitenant`) · Estado: borrador para revisión

## 1. Contexto y objetivo

La fase 1 dejó el tenant en la sesión, los módulos `xModule(ctx)` y los repositories con `tenantEq`.
La autorización sigue leyendo el rol **global** del usuario (`user.role`) contra una matriz fija
en `packages/guards`. En un sistema con varias organizaciones eso no alcanza: una persona puede
trabajar en dos organizaciones con funciones distintas, y un único valor global no puede
representarlo.

Esta fase pasa los roles y la matriz rol→permisos a la base de datos, **por organización**,
editables desde el portal, y hace que el rol que se evalúa sea el de la **membresía**. El
catálogo de permisos (recursos y acciones) sigue en código.

El trabajo se diseña para llegar a producción: corrección, seguridad, concurrencia y modos de
fallo están dentro del alcance.

### Limitaciones actuales que esta fase resuelve

- Un admin de organización no puede cambiar el rol, ni quitar a una persona que tiene más de una
  membresía (`USER_IN_MULTIPLE_ORGANIZATIONS`).
- `createTenant` y el alta de usuarios solo reescriben el rol global si la cuenta no tiene otras
  membresías.
- Los roles son 4 valores fijos que ninguna organización puede ajustar.

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Propiedad de los roles | Por organización. Al crear una organización se copian los 4 roles base como plantilla |
| Libertad | El admin de la organización crea, renombra, edita y borra roles. El rol dueño (`is_owner`) está protegido |
| Cuentas compartidas | El admin solo toca lo de su membresía (rol, quitar de su organización). Nombre, contraseña y enlace de contraseña son globales: solo el dueño de la cuenta o el admin de plataforma |
| Asociar un email existente | Sigue siendo solo del admin de plataforma |
| Enfoque | Tablas propias y evaluador propio. No se usa `dynamicAccessControl` de Better Auth |
| Plugin `organization` | Se mantiene para `organization`, `member` y `session.activeOrganizationId` |
| Transporte de permisos a la web | Query tRPC `tenant.permissions`, no sesión ni token |
| Control de acceso por ruta | Sale de `middleware.ts` y pasa a un guard dentro de `TenantGate` |
| Catálogo de permisos | Sigue en `@repo/guards` |

### Por qué no `dynamicAccessControl` (enfoque descartado)

Su tabla `organizationRole` guarda el nombre del rol como texto y los permisos como un único
string JSON. No hay clave foránea desde `member`, renombrar un rol deja a los miembros apuntando a
un nombre inexistente, la base de datos no puede validar ni consultar los permisos, y no existe
lugar para el scope `own/all`, `is_owner` ni `version`. Sus endpoints están bloqueados por HTTP a
propósito, así que habría que envolverlos igualmente.

## 3. Modelo de datos

Migración con `db:generate`, SQL revisado, `db:migrate` (sin `db:push`).

### `role`

| Columna | Detalle |
|---|---|
| `id` | text, PK |
| `organization_id` | FK a `organization`, NOT NULL, indexado |
| `name` | texto visible; único por `(organization_id, name)` |
| `is_owner` | boolean. Rol de superadmin de la organización: todos los permisos, no se borra ni se edita su matriz |
| `version` | integer, inicia en 1, sube en cada edición |
| `created_at`, `updated_at` | fechas |

### `role_permission`

| Columna | Detalle |
|---|---|
| `role_id` | FK a `role`, `ON DELETE CASCADE` |
| `resource`, `action` | text; validados contra el catálogo en código |
| `scope` | enum `own` / `all`, default `all` |
| PK | `(role_id, resource, action)` |

Una fila por permiso concedido. El `scope` va por permiso (más fino que el scope por recurso de
hoy): un rol puede tener `quote.read` en `own` y `quote.delete` en `all`.

### `role_audit_log`

Organización, actor, rol, acción (crear, editar, borrar, reasignar), estado anterior y posterior,
fecha. Se escribe en la misma transacción que el cambio.

### Cambios en tablas existentes

- `member.role_id`: FK a `role`, NOT NULL, `ON DELETE RESTRICT`.
- `member.role` (texto del plugin) y `user.role`: dejan de leerse para autorizar. Los escribe una
  única función para que no diverjan; su eliminación es un paso posterior y separado.
- `user.isPlatformAdmin` no cambia: es global y describe a la persona.

### Reglas de integridad

- El `role_id` de un miembro debe pertenecer a su misma organización. La FK sola no lo garantiza:
  se valida en el repository y con una prueba de aislamiento.
- Cada organización tiene exactamente un rol `is_owner`, y siempre con al menos un miembro.

### Plantilla inicial

`createTenant` copia los 4 roles base (Superadmin con `is_owner`, Admin, Operator, Member) con la
matriz que hoy vive en `rolesPermissions.matrix.ts`. Esa matriz queda como semilla de la
plantilla, no como fuente de autorización.

## 4. Evaluación en la API

### `ctx.access`

`protectedProcedure` ya verifica la membresía en cada petición. La misma consulta resuelve el rol:

```text
member (usuario + organización activa) → role → role_permission
```

```ts
ctx.access = {
  roleId, roleVersion, isOwner,
  grants: Map<'quote.read', 'own' | 'all'>
}
```

### `hasPermission`

Pasa a ser una función pura sobre `ctx.access` y el `PermissionCheck` de siempre. Vive en
`@repo/guards` y la usan la API y la web con la misma lógica.

- Con `isOwner`, devuelve `true` (el bypass del superadmin de hoy).
- Si no, exige que todos los permisos pedidos estén en `grants`.

`guardedProcedure(permisos)` mantiene su firma: los routers existentes no cambian.

### Scope own/all

`resolveResourceScope` lee de `ctx.access.grants`. El filtro de listas usa el scope de la acción
`read`/`list` del recurso; cada mutación comprueba el scope de su propia acción. Con varios roles,
`all` gana (hoy la membresía tiene un solo rol).

### Admin de plataforma sin membresía

Recibe un `ctx.access` sintético con `isOwner: true`, auditado como hoy en `platform_access_log`.
No necesita rol en la base de datos.

### Express

`guardTenantSession` usa la misma función de decisión y el mismo `ctx.access`, para que la ruta de
adjuntos no pueda desviarse de tRPC.

### Costo, versión y modo de fallo

- **Sin caché al inicio:** dos consultas indexadas pequeñas por petición. Si se mide que pesa, se
  cachea con clave `roleId:version`, de modo que una edición invalida sola con varias instancias.
- Cada respuesta incluye la cabecera `x-permissions-version: <roleId>:<version>`. Un endpoint
  ligero devuelve solo ese par.
- Un miembro sin rol, o con un rol de otra organización, se rechaza con 403. No hay valor por
  defecto: fallar cerrado.

## 5. Gestión de roles y usuarios

### Módulo `roles`

Patrón `resource → repository → service → router` y `rolesModule(ctx)`. Procedimientos: `list`,
`get`, `create`, `update` (nombre y matriz), `duplicate`, `delete`. El recurso `role` entra al
catálogo con `read`, `create`, `update` y `delete`; por defecto solo lo tiene el rol dueño.

### Reglas de seguridad (service, con pruebas)

1. **Sin escalada de privilegios:** quien edita un rol, o asigna uno, solo puede conceder permisos
   que él mismo tiene. No puede ampliar su propio rol ni crear uno más potente que el suyo.
2. **Rol dueño protegido:** no se borra, no se le edita la matriz, no se renombra a vacío.
3. **Último dueño:** no se puede quitar el rol dueño ni la membresía al último miembro que lo tiene.
4. **Borrado:** un rol con miembros no se borra (`RESTRICT`); el error indica cuántos reasignar.
5. **Asignar rol:** el `roleId` del `input` se resuelve con una lectura acotada a la organización
   (`docs/backend/architecture.md` §11.4).
6. **Concurrencia:** editar un rol exige la `version` leída. Si cambió, error
   `ROLE_VERSION_CONFLICT`. La edición y `version + 1` van en una transacción.
7. **Catálogo:** un recurso o acción inexistente se rechaza al validar el `input` (Zod en
   `@repo/schemas`).

### Módulo `users`

| Hoy | Con roles por membresía |
|---|---|
| El admin no puede cambiar el rol de una cuenta compartida | Cambia solo el `role_id` de su membresía |
| No puede quitar a alguien con varias membresías | Quita solo su membresía |
| `createTenant` y el alta reescriben `user.role` si no hay otras membresías | Escriben solo `member.role_id` |
| Nombre, contraseña y enlace de una cuenta compartida | Siguen protegidos (dueño de la cuenta o admin de plataforma) |
| Asociar un email existente | Sigue solo para el admin de plataforma |

`USER_IN_MULTIPLE_ORGANIZATIONS` queda solo para operaciones globales (nombre, enlace);
`USER_IS_PLATFORM_ADMIN` se mantiene.

### Sesiones y `createTenant`

Cambiar el rol no revoca sesiones: la petición siguiente ya lee el rol nuevo. Quitar la membresía
sí revoca las sesiones activas en esa organización, como hoy. `createTenant` crea la organización,
los 4 roles y asigna el rol dueño al admin inicial en una transacción.

## 6. Web

### Carga y evaluación

- `usePermissions()` (feature `tenant`) sobre `tenant.permissions`, `staleTime: 0`; devuelve los
  permisos con su scope y el par `roleId:version`.
- `TenantGate` espera organización y permisos antes de pintar.
- `useCan` y `<Can>` mantienen su firma y evalúan con la `hasPermission` pura sobre los permisos
  cargados. `useNavigation` y los puntos que hoy leen `user.role` pasan a `usePermissions()`.
  `useIsSuperAdmin` se sustituye por un flag `isOwner`.
- `RoleTag` y las listas de usuarios muestran el nombre del rol de la membresía.

### Actualización

- Un hook del cliente tRPC lee `x-permissions-version` de cada respuesta. Si difiere del par
  cargado, invalida `tenant.permissions`.
- Sondeo ligero cada 30–60 s que compara solo la versión; revalida también al volver el foco, tras
  editar un rol y ante un 403 por permiso. Un 403 por cambio de rol muestra un mensaje claro.

### Acceso a rutas

`middleware.ts` conserva solo sesión y `mustChangePassword` (corre en el edge y no puede leer la
caché de React Query ni la base de datos). El guard de rutas pasa a un componente dentro de
`TenantGate` que evalúa con los permisos cargados y redirige a la primera ruta permitida. La API
sigue siendo la barrera real.

### Editor de roles (feature `roles`, mobile-first)

- Lista con `DataTable` y card en móvil: nombre, número de miembros, marca de rol dueño, acciones
  por fila (editar, duplicar, borrar) con `<Can>`.
- Formulario con nombre y matriz por recurso, construido desde el catálogo de `@repo/guards`;
  selector `own/all` donde el catálogo lo permite; en móvil, un acordeón por recurso.
- Rol dueño con la matriz bloqueada. Permisos que quien edita no tiene, deshabilitados.
- Borrar un rol con miembros muestra cuántos hay y ofrece reasignarlos.
- Conflicto de versión: aviso de recarga conservando lo escrito.
- i18n es/en, `lucide-react`, fechas con `dayjs`, sin `uppercase`.

Se reemplazan `PermissionsMatrixCard` y el selector de rol de `UserForm`/`EditUserModal`, que hoy
usan los 4 valores fijos de `ROLES`.

## 7. Migración y despliegue

1. **Esquema aditivo:** tablas nuevas y `member.role_id` nullable.
2. **Datos:** por cada organización existente se crean sus 4 roles base y cada `member.role` se
   convierte a su `role_id`. Un valor de rol desconocido detiene la migración con un error claro;
   no se asigna uno por defecto.
3. **Endurecimiento:** `member.role_id` NOT NULL, índices y unicidades.
4. **Verificación:** `mt:verify` comprueba que ningún miembro queda sin rol, que cada rol pertenece
   a la organización del miembro y que cada organización tiene un rol dueño con al menos un miembro.

Orden de despliegue: primero esquema y datos (sin cambio de comportamiento), después el código que
autoriza por membresía. Cuando nada lea `user.role` ni `member.role` para autorizar, se dejan de
escribir; eliminar las columnas es un paso posterior y separado.

## 8. Pruebas

Postgres real para las de aislamiento.

- **Evaluación:** permiso concedido y no concedido; mismo usuario con distinto rol en dos
  organizaciones; edición de rol efectiva en la petición siguiente; fallo cerrado sin rol.
- **Aislamiento:** un admin de una organización no lee, edita, borra ni asigna roles de otra
  (suite de aislamiento de cada repository nuevo).
- **Seguridad:** escalada de privilegios, último dueño, rol dueño intocable, borrado con miembros,
  conflicto de versión, permisos fuera del catálogo.
- **Usuarios:** cambio de rol y quitar membresía en una cuenta compartida; los cambios globales
  siguen protegidos.
- **Auditoría:** cada cambio deja su fila. **Express:** la subida de adjuntos decide igual que tRPC.
- **Web:** `useCan`, guard de rutas, recarga por versión, editor (rol dueño bloqueado, permisos
  deshabilitados).
- Regresión: suites actuales de `api` y `web` en verde y `pnpm check-types` limpio.

## 9. Fuera de alcance

- Roles globales de plataforma editables y panel `/platform` (fase 4).
- RLS (fase 1b).
- Invitaciones con aceptación para asociar cuentas existentes.
- Permisos nuevos en el catálogo más allá de `role`.
- Notificación en tiempo real de cambios de rol (lo cubren la versión, el sondeo y el 403).

### Decisión abierta del handoff, ajena a esta fase

Qué hace un superadmin con varias organizaciones, o un admin de plataforma, al iniciar sesión
(recordar la última organización, un panel global o entrar a la primera). No depende de los roles.

## 10. Criterio de fase terminada

Suites en verde, `mt:verify` sin hallazgos sobre una base con varias organizaciones, `pnpm
check-types` limpio y checklist manual aprobada (la ejecuta el usuario): cambio de rol con dos
pestañas abiertas, rol editado mientras alguien lo usa y editor en móvil.
