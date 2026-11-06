# Checklist de regresión manual — Multi-tenant fase 1

Se ejecuta en `staging-mt` (y tras cada ensayo de migración) con la base migrada. Basado en `docs/mach-bar-flows.md`. Marcar cada ítem; cualquier fallo en las secciones A o B bloquea el cutover.

**Preparación.** Para los casos de dos tenants usar la demo local o una base de pruebas: `pnpm --filter api db:seed --demo=local` crea `demo-norte` y `demo-sur` con datos distintos (la numeración de cotizaciones de Sur empieza en 1001) y los usuarios `admin@norte.demo`, `admin@sur.demo`, `operator@…`, `member1@…`, `shared@demo.test` (miembro de ambos) y `platform@demo.test` (admin de plataforma, sin membresía). Ver `docs/backend/architecture.md` §8.1. No usar `--demo=local` en producción. En móvil, revisar cada flujo también en viewport chico.

## A. Flujos por área (un tenant, con el cliente migrado)

### Clientes (`/admin/clients`, ficha §7)
- [ ] Lista paginada, búsqueda y orden; mismos conteos que antes del cutover.
- [ ] Estado derivado: "activo" solo con una cotización Aprobada.
- [ ] Alta, edición y baja de un cliente; ficha con sus cotizaciones y eventos.
- [ ] Alta inline de un lead desde el constructor de cotización.

### Cotizaciones (constructor §2, pipeline §3)
- [ ] Crear cotización con líneas, opciones, descuento y cliente; guardar borrador y enviar.
- [ ] Numeración correlativa del tenant (sin saltos ni duplicados; crear dos seguidas).
- [ ] Editar una cotización existente; historial (`QuoteHistoryCard`) coherente.
- [ ] Pipeline: mover entre etapas respetando la matriz de transiciones; etapas con los nombres/colores del tenant (overlay `quote_stage_settings`).
- [ ] Asignar staff en Aprobada; el selector solo lista usuarios del tenant.
- [ ] Confirmar una cotización crea su evento.

### PDF
- [ ] Generar el PDF de una cotización existente y de una nueva; datos y plantilla del tenant; el PDF se abre desde su URL.
- [ ] Cambiar la plantilla en Configuración y regenerar: el cambio se refleja.

### Eventos (lista, detalle §6, calendario)
- [ ] Lista y detalle; selecciones de opciones, asignación de staff y disponibilidad (el staff ocupado en la fecha se detecta).
- [ ] Reprogramar con motivo y revisar conflictos de staff; realizar y cancelar un evento.
- [ ] Calendario con los eventos del tenant.

### Pagos y adjuntos
- [ ] Registrar un pago y subir un adjunto (archivo en R2 bajo `t/<tenantId>/event-payments/…` del bucket del entorno).
- [ ] Ver/descargar un adjunto existente (migrado) y uno nuevo.
- [ ] Eliminar un pago; totales y saldo del evento correctos.
- [ ] Subir un adjunto sin sesión o con otro tenant activo es rechazado.

### Staff
- [ ] Alta, edición y baja; disponibilidad por fecha; asignación a eventos.

### Catálogo (§4) y tipos de evento
- [ ] Editor de catálogo: crear/editar/reordenar productos, grupos y opciones; precios por escalón de personas; soft-delete.
- [ ] Nombres únicos por tenant (el mismo nombre en otro tenant no choca).
- [ ] Tipos de evento y motivos de reprogramación: CRUD.

### Configuración (§5)
- [ ] Ver y guardar porcentajes, impuestos y datos del negocio; persisten al recargar.
- [ ] Editar etiquetas/colores de etapas: solo cambian para el tenant actual.
- [ ] Plantillas (es/en).

### Usuarios
- [ ] Alta con enlace de contraseña (`WEB_APP_URL`); primer ingreso con cambio de contraseña obligatorio.
- [ ] Cambio de rol, regenerar enlace, eliminar usuario (se quita la membresía; la sesión de ese usuario en este tenant se cierra).
- [ ] Un admin de tenant no ve a los `superadmin` en la lista.
- [ ] Preferencias de usuario (idioma/tema) se guardan por tenant.

### Notificaciones
- [ ] Aparecen las del tenant actual; marcar leída / descartar / marcar todas.
- [ ] Abrir una notificación navega a su cotización o evento.
- [ ] Recordatorios: los crons están **desactivados** en esta fase; si hace falta probarlos, `pnpm --filter api jobs:event-reminders --tenant=<slug>` a mano en staging-mt.

### Dashboard (§8)
- [ ] KPIs, gráficas y top productos del tenant, coherentes con las listas.
- [ ] Vista por rol (RBAC) y móvil.

## B. Aislamiento con dos tenants (Norte y Sur)

Con la sesión en Norte, ninguno de estos casos debe mostrar, modificar ni revelar datos de Sur:

- [ ] Cada lista (clientes, cotizaciones, eventos, pagos, staff, catálogo, tipos, motivos, notificaciones, usuarios) muestra solo datos de Norte; los conteos del dashboard también.
- [ ] Abrir por URL el id de un registro de Sur (`/admin/clients/<id>`, cotización, evento): "no encontrado", igual que un id inexistente.
- [ ] Constructor de cotización: el combobox de clientes, tipos de evento y catálogo solo traen datos de Norte.
- [ ] Crear en Norte un cliente con el mismo nombre que uno de Sur, un producto con el mismo nombre y un motivo igual: permitido (unicidad por tenant).
- [ ] Numeración independiente: la cotización nueva de Norte y la de Sur siguen cada una su propia secuencia; crear dos a la vez en Norte no duplica número.
- [ ] Editar la configuración, plantillas y etapas en Norte no cambia nada en Sur (y viceversa).
- [ ] Asignar staff/usuario de Sur a un evento de Norte (manipulando la petición) es rechazado como "no encontrado".
- [ ] Adjuntos: la URL/archivo de un pago de Sur no es accesible desde Norte (clave con prefijo de tenant).
- [ ] Notificaciones: abrir una de Sur desde Norte no genera error visible ni revela datos.
- [ ] Cambiar de organización (usuario con ambas) limpia por completo la vista anterior, sin datos del tenant previo.
- [ ] Un cambio de organización surte efecto en la petición siguiente.

## C. Login y organización (casos cruzados)

- [ ] **0 organizaciones** (no admin de plataforma): login rechazado con el mensaje de "no pertenece a ninguna organización"; sin sesión.
- [ ] **1 organización:** entra directo a `/admin`; el menú de usuario no ofrece "Cambiar de organización"; sin aviso de plataforma.
- [ ] **Varias organizaciones** (`shared@demo.test`): tras el login, pantalla de selección; elegir una entra a `/admin`; "Cambiar de organización" disponible; abrir `/admin` sin organización activa redirige a la selección.
- [ ] **Admin de plataforma** (`platform@demo.test`, sin membresías): entra sin organización activa; la selección lista todas (con búsqueda); al entrar a una organización donde no es miembro aparece el aviso "modo plataforma" (escritorio y móvil) y entra con permisos totales; existen filas en `platform_access_log` (primera consulta de la sesión por tenant y cada mutación).
- [ ] **Miembro removido:** quitar a un usuario de la organización (o de su tabla `member`) con sesión abierta: su siguiente petición de datos es rechazada y vuelve a la selección/login (la caché de cookie de 60 s puede retrasar solo lo que lee la sesión cacheada).
- [ ] **Organización activa de otra organización donde ya no es miembro:** rechazado.
- [ ] `tenant.select` con una organización ajena (no miembro, no admin de plataforma): rechazado.
- [ ] **Usuario compartido** (`shared@demo.test`, rol `operator` en Norte, `member` en Sur): un admin de Norte no puede cambiar su rol, nombre, regenerar su enlace ni eliminarlo (`USER_IN_MULTIPLE_ORGANIZATIONS`); un admin de plataforma sí puede modificarlo, y si lo elimina en Norte solo se quita esa membresía y sigue entrando a Sur.
- [ ] Un admin de Norte intenta crear un usuario con el email de una cuenta existente en Sur: recibe "ya existe" (no puede adjuntarla); un admin de plataforma sí puede adjuntarla sin tocar su contraseña.
- [ ] Un admin de tenant no puede crear ni degradar a un admin de plataforma (`USER_IS_PLATFORM_ADMIN`).
- [ ] Credenciales incorrectas muestran el mensaje genérico, sin distinguir usuario inexistente de contraseña errónea; tras varios intentos fallidos el login responde 429 (límite activo).
- [ ] Orígenes no listados en `WEB_ORIGIN` son rechazados por CORS; el registro público (`/api/auth/sign-up/email`) y los endpoints de `organization`/`admin` responden bloqueados por HTTP, también con un administrador.
- [ ] Los enlaces de contraseña y de notificaciones usan el host de `WEB_APP_URL`.
- [ ] Tras iniciar sesión con otra cuenta en el mismo navegador no se ven datos de la cuenta anterior.

## D. Después de la migración del tenant #1

- [ ] Sesiones abiertas antes del cutover siguen funcionando sin volver a iniciar sesión.
- [ ] `mt:verify` sin problemas; conteos iguales a `verify-pre.txt`.
- [ ] Los superadmin actuales son miembros del tenant #1 y administradores de plataforma (su acceso a ese tenant no se audita).
- [ ] Archivos y PDFs anteriores al cutover siguen abriendo.
