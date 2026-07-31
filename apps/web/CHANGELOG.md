# Changelog

Todos los cambios notables de Mach Portal (web) se documentan en este archivo.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto usa [Semantic Versioning](https://semver.org/lang/es/).

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
