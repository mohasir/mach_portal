# Changelog

Todos los cambios notables de Mach Portal (web) se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto usa [Semantic Versioning](https://semver.org/lang/es/).

## [0.13.0] - 2026-09-03

### Added

- Campo "Notas para el cliente" en el builder de cotización (`NotesSection`),
  separado de las notas internas existentes — su contenido aparece en el PDF de la
  cotización.

## [0.12.0] - 2026-09-03

### Added

- Asignar, reasignar y desasignar una cotización a un usuario interno: avatar
  clickeable en la card del pipeline (`QuoteCardAssignment`/`QuoteAssignmentAvatars`)
  y en el header de detalle/builder (`QuoteNumberHeader`), con bottom sheet
  buscable (`AssignQuoteSheet`). Solo visible/editable para superadmin/admin
  (`useCanReassignQuote`, atado al nuevo permiso `manage_assignment`).
- Historial de asignaciones en la actividad de la cotización (`QuoteHistoryCard`):
  quién asignó/reasignó/desasignó y a quién, junto al historial de etapas.
- Depósito editable desde el builder y el preview de cotización (`QuoteSummary`):
  bottom sheet para elegir 10/20/30/40/50% sin salir de la pantalla.
- `getInitials`/`getAvatarColor` (`lib/utils/name`): las iniciales de un avatar
  ahora ignoran tildes y caracteres no alfanuméricos (ej. "Álvaro Núñez" → "AN"),
  y el color de fondo varía por usuario en vez de ser siempre olive.

### Changed

- El modal de "asignar staff" del pipeline (`AssignStaffModal`) se reemplaza por
  `AssignStaffSheet` (bottom sheet, mismo patrón que el resto de la app), ahora
  disponible también desde el listado de Eventos y no solo desde su detalle; la
  card de cotización del pipeline deja de mostrar el staff del evento (queda
  enteramente en el detalle de evento).
- Todos los avatares de usuario de la app (menú de usuario, topbar mobile, cuenta
  bloqueada, resumen de perfil mobile) pasan a usar el componente compartido
  `AvatarUser` en vez de `Avatar` + lógica de inicial duplicada en cada uno.
- El selector de cliente existente en el builder de cotización (`ClientSection`)
  pasa de un `Select` con dropdown a una lista buscable en bottom sheet,
  consistente con los nuevos sheets de asignación.
- Ajustes visuales menores: nuevo tamaño `xs` en `IconBadge`, `borderRadiusSM` del
  tema de 4 a 6px, padding/gap del `QuickLineCard` y del grid de `QuickLineBuilder`.

### Fixed

- El teléfono de clientes/staff sembrados se mostraba como solo "+1" (sin el resto
  del número) en cards y avatares — causado por datos seed sin código de país
  (ver CHANGELOG del API); corregido en el origen de los datos.

## [0.11.0] - 2026-09-02

### Added

- "Creado por" en la card de cotización del pipeline (`QuoteCardBody`), en la card
  de evento (`EventCard`) y en el detalle de cotización/evento — quién creó la
  cotización de origen.
- Componente compartido `QuoteNumberHeader` (número, botón de copiar y "Creado
  por", con acceso rápido opcional a la cotización) usado en el detalle de
  cotización y de evento.
- Nueva sección "Detalle del evento" en el detalle de evento: tipo de evento,
  fecha junto al tag de estado (Próximo/Realizado/Cancelado) y dirección.
- `EventCard` soporta un modo `plain` (sin card propia) y ocultar el "Creado
  por" — usado en "Próximos eventos" del dashboard, con un divider entre
  eventos en vez de cards individuales.

### Changed

- El header del detalle de cotización se reorganiza: el título de la página
  pasa a ser fijo ("Detalle de cotización"), y el número de cotización, el
  botón de copiar y la descarga/compartir del PDF se mudan a la misma card
  que el dropdown de cambio de estado (antes el número vivía en el header de
  la página, y la descarga solo aparecía ahí en desktop).
- El header del detalle de evento se reorganiza con la misma estructura:
  número de cotización + copiar + acceso a "Ver cotización" (ahora un ícono,
  antes un botón con texto) en una fila, "Creado por" debajo.
- Al crear un usuario o reenviar el link de contraseña, el mensaje para
  copiar/compartir ahora saluda por nombre e incluye el correo (antes
  mostraba solo el link pelado); "Copiar link" vuelve a copiar solo la URL,
  "Compartir" comparte el mensaje completo por la hoja nativa.
- El dashboard muestra "Próximos eventos" primero (antes iba al final,
  compartiendo fila con "Productos más pedidos", que ahora ocupa el ancho
  completo).
- El ítem "Asignar staff" del menú de acciones del listado de Eventos ahora
  requiere el permiso `manage_staff_assignments` en vez del genérico de
  edición de evento, consistente con el detalle del evento — así el rol
  Operador (que solo tiene ese permiso, con scope propio) también lo ve ahí.

### Fixed

- El bottom nav mobile se ocultaba solo en Configuración y en el detalle de
  Eventos/Productos; ahora se deriva de la lista real de secciones de
  "Opciones" (`ADMIN_MENU`), así que también se oculta en Clientes, Staff,
  Pagos, Tipos de evento, Usuarios y los listados de Productos/Eventos.

## [0.10.0] - 2026-09-02

### Added

- Flujo de configuración de contraseña para usuarios nuevos (o reset): al crear un
  usuario, o pedir que reestablezca su contraseña desde Usuarios, el superadmin ya
  no ve ni fija la contraseña real — se genera un link de un solo uso
  (`/set-password`, `SetPasswordPage`) que se copia o se comparte por la hoja
  nativa del dispositivo (`PasswordSetupLinkResult`, mismo fallback que
  `ShareButton`) para mandarlo manualmente (WhatsApp, etc). Mientras el usuario no
  lo use, su cuenta queda bloqueada al iniciar sesión (`AccountLocked`). Nuevo
  `WrapperModal` (modal propio con header y botón de cierre de marca), usado en el
  modal de creación de usuario y en el nuevo `PasswordSetupLinkModal` (reenviar
  link desde el listado de Usuarios).
- Aviso de disponibilidad al elegir fecha y hora en el builder de cotización
  (`EventSection`, `useQuoteAvailability`): si ya hay otra cotización con evento en
  ese mismo horario, se muestra un aviso no bloqueante con el cliente y tipo de
  evento en conflicto (la doble reserva sigue permitida, es solo un heads-up).
- Editores propios para servicios, términos y condiciones, y notas de la plantilla
  de PDF de cotización (`ServiceDurationsEditor`, `TermsAndConditionsEditor`,
  `NoteCardEditor`, en Configuración > Plantilla PDF): cada ítem se agrega, edita o
  quita individualmente en una card con confirmación al eliminar, en vez de filas
  de formulario o un textarea de líneas separadas por salto.

### Changed

- Rol "Manager" pasa a llamarse "Operador" en la UI (`RoleTag`, matriz de permisos
  de Configuración) — ya estaba renombrado como `operator` en el backend, faltaba
  actualizar estos dos lugares.
- Cotizaciones y eventos ahora respetan el scope de permisos del rol (own/all): un
  rol con scope propio (ej. Operador) solo ve y gestiona las cotizaciones que creó
  o tiene asignadas, y los eventos de esas cotizaciones — listados, detalle,
  pipeline, pagos, selecciones y staff quedan fuera de su alcance en el servidor,
  no solo ocultos en la UI.
- Fijar en una línea del builder un `numPersons`/precio que no corresponda a un
  tramo del catálogo (precio personalizado) pasa a requerir permiso de admin o
  superadmin — sin él, la vista rápida de estaciones (`QuickLineCard`) ya no
  muestra el botón de editar precio.
- Asignar o quitar staff de un evento (`EventStaffPanel`) pasa a requerir un
  permiso propio en vez del genérico de edición de evento; el panel además deja
  de envolverse en su propia card (vivía ya dentro de una).
- Tarifas por tramo del catálogo (`PriceTiersForm`): agregar, editar y quitar un
  tramo ahora se controlan con permisos independientes (antes un solo flag
  gobernaba los tres botones).
- El ítem "Dashboard" de la navegación pasa a llamarse "Inicio" (ícono `Home`) y
  queda siempre visible, sin importar el permiso de lectura del dashboard.

## [0.9.0] - 2026-08-30

### Added

- Centro de ayuda (`/admin/settings/support`): acordeón de categorías con
  buscador, contenido en Markdown (es/en, con imágenes y notas) por
  artículo, y tabla de contenidos / "artículos relacionados" autogenerados
  a partir de los encabezados. 9 categorías y 23 artículos (Cotizaciones,
  Eventos, Calendario, Catálogo, Tipos de evento, Clientes, Personal,
  Configuración, Instalación); cada artículo se filtra con el mismo
  permiso (`useCan`) de la acción que documenta, así cada rol ve solo lo
  que puede hacer. La categoría que se dejó abierta se recuerda al volver
  de un artículo (`support.store.ts`, Zustand).
- Página "Acerca de" en Configuración (`AboutSettingsForm`, sección
  `about`): nombre y versión de la app.
- Selector de color por tipo de evento (`EventTypeForm`, `ColorPicker` de
  AntD con 15 presets de marca + hex libre): columna de color en el
  listado de Tipos de evento; el calendario de eventos ahora pinta cada
  evento con el color de su tipo (`EventDayCard`, `CalendarDayEvents`) en
  vez de un color fijo por estado.

### Changed

- Login (`AuthPage`): se quita el modo de registro (self-signup) — la
  pantalla ahora es solo inicio de sesión, con logo y card rediseñados
  (`WrapperCard`).
- Pie de copyright (`Copy`) rediseñado y movido a un componente `Footer`
  reutilizable, fijo al fondo del login; ya no muestra versión/commit
  (antes leía `env.NEXT_PUBLIC_APP_VERSION`/`NEXT_PUBLIC_APP_COMMIT`
  directo) — ese dato se ve ahora en la página "Acerca de".
- Fondo de contenido del layout (`useContentBg`) simplificado a un solo
  color fijo para toda la app, en vez de alternar blanco/gris según la
  ruta.

## [0.8.0] - 2026-08-25

### Added

- Teléfono formateado (`FormattedPhone`, mismo mask de país que `PhoneInput`) en las
  listas de clientes y en el detalle: `ClientCard`, la columna de teléfono de la
  tabla y `ClientInfoCard` ahora renderizan el valor guardado con el formato
  "+1 (131) 321-3123" en vez del string crudo.
- Donut de participación en "Productos más pedidos" del dashboard (`TopProductsList`,
  Recharts): top 2 + "otros" como gráfico, además del listado existente con
  porcentajes; la card ahora muestra el mes/año del período como caption
  (`monthYear`, nuevo formatter de `useDateFormatter`).
- `DayView`, vista de agenda de un solo día para el calendario de eventos (línea de
  hora actual, franja de eventos por hora); todavía no conectada al selector de
  vista del calendario.

### Changed

- Toolbar del calendario de eventos (`CalendarToolbar`): el buscador y el acceso
  directo a Configuración se reemplazan por un `Segmented` Mes/Semana; la vista Año
  queda sin botón en el selector (el código de `YearView` no se tocó). Mes y Semana
  se envuelven ahora en `WrapperCard`.
- Eventos del calendario (`CalendarDayEvents`, nuevo `EventDayCard`): la vista
  compacta (mes, mobile) muestra un punto de color por estado en vez de un contador;
  la vista expandida (semana, día del mes en desktop) usa la misma card con franja
  de color en los lugares donde antes había un `Badge` de texto o un botón suelto.

## [0.7.0] - 2026-08-13

### Added

- Dashboard con datos reales (`/admin`), cierra el dominio Mach Bar:
  reemplaza los 3 stat cards con valores fijos que traía el placeholder
  original por un resumen de solo lectura del mes actual — eventos,
  ingresos, cotizaciones y tasa de cierre (`MetricCard`), gráfico de
  cotizaciones por mes (`QuotesByMonthChart`, con Recharts) y ranking de
  estaciones más pedidas (`TopProductsList`). Cada bloque se oculta según
  permiso del rol (`<Can>`); "Próximos eventos" queda sin cambios.

## [0.6.0] - 2026-08-12

### Added

- Toggle "Aplicar impuesto por estado" en Configuración > Impuestos
  (`TaxRatesCard`): permite desactivar el cálculo de impuesto para todas las
  cotizaciones sin borrar las tasas configuradas; con el toggle apagado, la
  lista de tasas por estado se oculta y el resumen de la cotización deja de
  mostrar la línea de impuesto.
- Recargo por pago con tarjeta/cheque, configurable en Configuración >
  Cotizaciones (`QuoteDefaultsCard`, tasa por defecto 9%) y aplicable por
  cotización desde un switch en Cargos extra del builder
  (`ExtraChargesSection`); se calcula sobre el total ya con impuesto y se
  muestra como línea separada en el resumen, el detalle y el PDF.
- Indicador de estado de pago en la card de evento mobile (`EventCard`):
  franja de color a la izquierda y tag (Pendiente/Parcial/Pagado) en el
  listado de Eventos, ahora calculado en la API a partir del total
  efectivamente pagado (antes solo estaba disponible en el detalle del
  evento).

### Changed

- Página de Productos: el menú de secciones (Estaciones/Precios) pasa de un
  `Card` con menú vertical al costado a un `Segmented` horizontal arriba del
  contenido; las secciones ya no quedan envueltas en una card adicional.
- Las secciones del builder de cotización (Cliente, Evento, Líneas, Notas,
  Cargos extra) migran del `Card` de AntD al `WrapperCard` propio de la app,
  que ahora soporta un slot `extra` (usado para el botón "Cambiar" de
  Cliente y el tag de estado en Pagos).
- Card de Pagos en el detalle de evento (`EventPayments`) rediseñada: total,
  pagado y saldo se muestran en bloques separados, y registrar un pago pasa
  de formulario inline a un bottom sheet dedicado.
- Formularios de Opción y Grupo de opciones (catálogo) pasan de modal a
  bottom sheet, consistente con el resto de formularios en mobile.
- Aumentado el tamaño de fuente base de la app de 13px a 14px; el label de
  los campos de formulario ahora tiene su propio padding inferior en vez de
  depender del alto de línea del contenido.

## [0.5.0] - 2026-08-08

### Added

- Centro de notificaciones (`/admin/notifications`): listado paginado con
  scroll infinito, agrupado por fecha (Hoy/Ayer/Esta semana/Este mes/Este
  año/Más antiguas), con avatar de quien originó la notificación (o ícono
  para las del sistema) y opción de marcar todas como leídas.
- El ícono de notificaciones del topbar (`NotificationMenu`) ahora muestra
  un preview real de las últimas notificaciones no leídas (antes un estado
  vacío fijo), con badge cuando hay pendientes y acceso directo al centro
  de notificaciones.
- Notificaciones de cotización confirmada/cancelada para los admins (menos
  quien hizo la acción), al aprobar o cancelar una cotización.
- Notificación diaria de selecciones de estaciones pendientes por evento:
  avisa cuando quedan 3 días o menos para el vencimiento de confirmación de
  un evento sin selecciones hechas.

### Changed

- `AddressLines` ahora muestra el nombre completo del estado (ej.
  "New York") en vez de la abreviatura (ej. "NY").
- Card de evento en mobile (`EventCard`): la hora pasa de badge junto a las
  acciones a texto plano debajo de la card de fecha (día/mes).

## [0.4.0] - 2026-08-05

### Added

- Sección de Pagos (`/admin/payments`): listado paginado con filtros de rango
  de fechas, cliente, tipo de evento y método, y una vista de ingresos
  agrupados por semana/mes/año, con selector de vista (`Segmented`)
  persistido en la URL.
- Flujo de selección de opciones de estaciones desde el evento: bottom sheet
  dedicado (`StationSelectionsSheet`) para elegir/editar las opciones
  pendientes de cada estación, y su contraparte de solo lectura
  (`StationSelectionDetailSheet`) para ver el detalle de lo ya elegido.
  Ambos comparten un header con ícono, nombre, cantidad de personas y precio
  de la estación, y muestran cada grupo de opciones en una card con contador
  de seleccionadas/máximo permitido y marca de check (o tag "Incluido" para
  los grupos que no requieren elección).
- Aviso en el detalle del evento (vía `WrapperAlert`) cuando el evento ya
  pasó su fecha, o cuando quedan selecciones de estaciones pendientes de
  confirmar (con su fecha límite, si aplica).
- Preferencia "Elegir opciones ahora" en Configuración > Cotizaciones
  (`QuoteBuilderPreferencesCard`): define si las opciones de cada estación se
  resuelven al armar la cotización o quedan pendientes para el evento; nuevo
  campo de días de margen antes del evento para la fecha límite de
  selección.
- Tag de progreso ("Sin selección" / "X/Y seleccionadas") junto al nombre de
  la estación en `QuickLineCard` cuando está en modo selección.
- Componente `WrapperAlert`, reemplazo propio del `Alert` de AntD: 5 tipos
  semánticos (`primary`/`success`/`info`/`warning`/`error`), ícono
  desacoplable del color del tipo (`icon` puede diferir de `type`), y un
  modo con botón de acción para avisos tipo banner.
- El total de resultados de cualquier tabla (`DataTable`) ahora se muestra
  siempre arriba de la tabla (antes solo en Pagos, con una implementación
  manual por fuera del componente).
- Iconografía propia (`assets/icons/option_*.svg`) para las cards de la
  página de Opciones, en vez de los íconos de `lucide-react` usados en el
  resto de la navegación.

### Changed

- Página de Configuración: layout unificado entre mobile y desktop (los
  formularios se movieron a `components/forms/` y ambas vistas comparten el
  mismo `WrapperCard`); la navegación inferior (bottom nav) se oculta en las
  páginas de Configuración.
- En mobile, el modo card de las tablas (`DataTable`) ya no dibuja el fondo
  blanco ni el borde entre filas de AntD debajo de cada card — evitaba un
  efecto de "doble tarjeta" ahora que cada fila ya trae su propio fondo; el
  padding vertical de la celda también se redujo, para achicar el espacio
  entre cards.
- El padding interno de todos los `Card` de AntD pasa a 18px (antes el valor
  por defecto de AntD); `Card` ya no soporta la variante de tamaño `small`
  (unificado a un solo tamaño en toda la app).
- El radio del ítem activo y el fondo de los inactivos en `Segmented` ahora
  son consistentes con la marca (10px de radio, fondo "olive faint").
- El bottom sheet compartido (`BottomSheet`) soporta un footer fijo (fuera
  del área con scroll) para acciones primarias tipo "Guardar".
- Los filtros de Pagos usan dos `DatePicker` independientes (desde/hasta) en
  vez de un `RangePicker`, con ajustes de tamaño para mobile.

### Fixed

- El bottom sheet compartido, al cerrarse, a veces quedaba visualmente
  trabado sin el fondo opaco (o se volvía a mostrar vacío) cuando su
  contenido se vaciaba en el mismo render en que se cerraba — el `Drawer`
  de AntD (con altura automática) necesita contenido estable para animar el
  cierre correctamente. `BottomSheet` ahora retiene el último contenido
  válido mientras está cerrando, y las pantallas que antes desmontaban el
  sheet entero al cerrar (selección de estaciones) pasaron a solo alternar
  su estado de apertura.

## [0.3.0] - 2026-07-31

### Added

- Card de cliente (`QuoteClientCard`) en el detalle de cotización, con avatar,
  teléfono y acceso directo al perfil del cliente.
- Botón de acción rápida (ícono "+") en el header mobile de Productos,
  Clientes, Tipos de evento y Staff para crear sin abrir el menú de acciones.
- Navegación "volver" hacia la página de Opciones desde Productos, Clientes,
  Tipos de evento, Staff, Usuarios, Eventos y Configuración en mobile.
- Página de Opciones como feature module propio (`features/options`).
- Widget de "Próximos eventos" (`UpcomingEventsCard`) en el dashboard, con los
  3 eventos más próximos y acceso directo al listado completo.
- Filtro por segmento (Próximos / Pasados / Todos, con contador) en el listado
  de Eventos.
- El estado (stage) de una cotización ahora es un tag desplegable
  (`QuoteStageTagDropdown`) para cambiarlo directamente desde el pipeline, el
  detalle y el builder, sin ir al pipeline; mantiene las mismas confirmaciones
  de antes (aprobar, cancelar, aviso al salir de "Pendiente" siendo borrador).
- Tag de "Borrador" con ícono de alerta cuando la cotización está incompleta,
  visible en el listado, el pipeline y el detalle.
- El número de cotización ahora se puede copiar con un clic en el listado y
  las cards del pipeline; el builder y el detalle suman un botón dedicado
  para clonar el número, además del de copiar el link.
- Modales de confirmación propios para mobile (`ConfirmModal`,
  `DeleteConfirmModal`), con ícono y estilo de marca en vez del
  `modal.confirm` genérico de AntD — usados al eliminar, cancelar
  evento/cotización, marcar completado, remover staff/adjuntos y cambiar de
  etapa.
- Confirmación al salir del builder de cotización habiendo cambios sin
  guardar.
- Componente `AddressLines` para mostrar dirección + ciudad/estado en una o
  dos líneas (con truncado), usado en cliente, eventos y cotizaciones.
- Componentes `MoneyInput` y `PercentInput` que unifican el manejo de dinero
  (centavos) y porcentajes en los formularios de la app.
- `AutoCloseTimePicker` para el campo de hora del builder de cotización.

### Changed

- El listado de Eventos ordena por fecha ascendente por defecto (el más
  próximo primero).
- Al crear o guardar una cotización, ahora redirige a
  `/admin/quotes?view=pipeline` (antes `/admin/events?view=pipeline`).
- El builder de cotización distingue el estado de carga de "Guardar borrador"
  y "Crear cotización": cada botón muestra su propio spinner y el otro queda
  deshabilitado mientras se procesa. Al editar una cotización que ya dejó de
  ser borrador, el botón principal pasa a decir "Actualizar".
- Card de evento en mobile (`EventCard`) rediseñada: chip de día/mes en vez de
  fecha en texto plano, hora en badge, y dirección agregada debajo del tipo de
  evento.
- El selector de país de `PhoneInput` queda fijo en Estados Unidos (código +1
  forzado, sin dropdown de país).
- `PageHeader` soporta volver a una ruta fija (`backHref`) además de
  `router.back()`, y un título más chico (`titleSize="sm"`) para vistas donde
  el título es largo (ej. número de cotización).
- Aumentado el tamaño de fuente base de textos secundarios (tags, filas de
  tablas/cards, menús) de 14px a 16px en toda la app, para mejorar la
  legibilidad.
- El cliente de autenticación usa el origin del navegador solo en desarrollo
  (para poder probar el login desde otro dispositivo en la LAN); en
  producción sigue usando la URL configurada en `NEXT_PUBLIC_APP_URL`.

### Fixed

- En iOS Safari, enfocar cualquier campo de texto hacía zoom automático del
  viewport (el tamaño de fuente base del tema, 13px, está por debajo del
  umbral de 16px de Safari) — se sube a 16px solo en mobile.
- Al cambiar de etapa una cotización (drag-and-drop en el pipeline o desde el
  tag desplegable) ahora se muestra un mensaje de confirmación ("Cotización
  movida correctamente"); antes no había feedback de que la acción se había
  completado.
- En mobile, el hover "pegado" de las filas de tablas (quedaba resaltada
  hasta tocar en otro lado) se eliminó, ya que en touch no existe el
  concepto de hover.
- Los campos de dinero (tarifas del catálogo, pagos, cargos extra, precio de
  línea, descuento) mostraban siempre un "$" fijo; ahora usan el símbolo de
  moneda configurado.
- En mobile, elegir una opción en los selects de cliente, ciudad, producto y
  staff dejaba el campo enfocado con el teclado abierto; ahora se le quita el
  foco automáticamente en dispositivos táctiles.
- El selector de hora del builder de cotización cerraba el popup apenas se
  tocaba hora o minuto; ahora espera a que se elijan ambos antes de cerrarse
  solo.

## [0.2.0] - 2026-07-28

### Added

- Cargo por larga distancia editable en el builder de cotización, con sugerencia
  automática a partir de la tasa del estado seleccionado (editable siempre).
- Rediseño mobile del builder de cotización: secciones de Cliente, Detalle del
  evento, Dirección y Cargos extras agrupadas en cards independientes.
- Flujo de Cliente en mobile con bottom sheets para seleccionar/crear cliente,
  card resumen con avatar, y opción de "Cambiar" (editar o seleccionar otro).
- Nueva vista rápida de estaciones (`QuickLineBuilder`) en mobile: agrega
  estaciones en formato card sin tener que elegir ingrediente por ingrediente
  (se incluyen todas las opciones disponibles por defecto), con cantidad y
  precio editables desde un bottom sheet.
- Botón de compartir (`ShareButton`) en el detalle de cotización: comparte el
  PDF vía la hoja nativa del dispositivo cuando está disponible, o copia el
  enlace al portapapeles (con fallback manual para HTTP sin contexto seguro).
- Ícono de copiar enlace en el header del detalle de cotización.
- Componente reusable `PhoneInput` (selector de país + código de marcado) en
  los formularios de Clientes, Staff y Cliente nuevo (cotizaciones).
- Fondo de contenido configurable por página en el layout mobile (blanco por
  defecto, gris sutil en el builder de cotización).

### Changed

- Todos los `Form.Item` de la app ahora usan el componente `FieldLabel` para
  el label, de forma consistente.
- Botones, inputs, `InputNumber` y `DatePicker`/`TimePicker` ahora tienen 38px
  de alto (antes 32px); se quitó el padding vertical por defecto entre label y
  control en todos los formularios (`layout="vertical"`).
- El cliente de autenticación ahora usa el origin real del navegador en vez de
  una URL fija, para que el login funcione al entrar desde otro dispositivo en
  la misma red (no solo `localhost`).
- El PDF y la vista previa de la cotización ahora muestran el cargo por larga
  distancia y el impuesto como líneas separadas (antes el impuesto aparecía
  mal etiquetado como "Long Distance Travel Fee").
- El generador de keys internas de línea del builder de cotización dejó de
  depender de `crypto.randomUUID()` (fallaba en contextos no seguros, ej. HTTP
  sobre una IP de LAN al probar desde el celular) — ahora usa un fallback
  simple, ya que esas keys nunca viajan al servidor.

## [0.1.0] - 2026-07-22

### Added

- App instalable como PWA (manifest + service worker).
- Navegación mobile rediseñada: bottom nav + pantalla de Opciones.
- Topbar mobile con perfil de usuario.
